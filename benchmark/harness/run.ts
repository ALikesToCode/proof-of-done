/**
 * Runs coding agents on tasks and writes one record per run.
 *
 *   npx tsx benchmark/harness/run.ts --set pilot --reps 1 [--tasks a,b] [--agents x,y] [--parallel 4]
 *
 * For each task, agent and repeat:
 *   1. a fresh workspace gets TASK.md, the starter code and the visible tests,
 *   2. the agent works until it stops, and its claim is read from proof/evidence.json,
 *   3. the hidden tests run against what it left (the truth),
 *   4. its evidence goes through the app's submit-evidence, which runs the checks,
 *   5. when it claimed done, it gets one more turn in the same session to judge its own evidence.
 *
 * A run whose record exists is skipped, so the command can be repeated after a stop.
 */
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { Driver, Turn, drivers } from './agents';
import { EvidenceInput, GateSession, ParsedVerdict, SubmitOutcome, parseVerdicts } from './gate';
import { RECORDS_DIR, Task, TestResult, WORK_ROOT, evaluate, extractJson, loadTasks, parseArgs, pool, writeJson } from './lib';
import { agentPrompt, selfReviewPrompt } from './prompts';

const WORK_TIMEOUT_MS = 20 * 60_000;
const REVIEW_TIMEOUT_MS = 5 * 60_000;

export type Claim = 'done' | 'not_done' | 'none';

export interface TurnSummary {
  ok: boolean;
  error: string | null;
  timedOut: boolean;
  wallMs: number;
  reportedModel: string | null;
  usage: Turn['usage'];
  final: string;
}

export interface RunRecord {
  runId: string;
  set: string;
  task: string;
  category: Task['category'];
  agent: string;
  agentLabel: string;
  rep: number;
  startedAt: string;
  work: TurnSummary;
  /** `done` only when the agent said so. A run that crashed, timed out or left no usable claim counts as `none`. */
  claim: Claim;
  /** Where the claim was read from. */
  claimSource: 'evidence_file' | 'last_message' | 'none';
  evidenceFile: 'valid' | 'missing' | 'invalid';
  note: string;
  evidence: EvidenceInput[];
  /** The hidden tests against what the agent left. `ok` is the truth about "done". */
  hidden: TestResult;
  /** The task's own copy of the visible tests against what the agent left. */
  visible: TestResult;
  visibleTestsEdited: boolean;
  /** What submit-evidence answered for each piece. */
  submitted: SubmitOutcome[];
  /** What list-evidence-to-review returns after the submissions. The same for every reviewer. */
  queue: unknown;
  selfReview: {
    asked: boolean;
    turn: TurnSummary | null;
    verdicts: ParsedVerdict[] | null;
    /** True when the solution files changed during the review turn. */
    filesChanged: boolean;
  };
  /** The solution files after the work, for the review variant that shows the source. */
  solution: Array<{ name: string; text: string }>;
}

const summary = (turn: Turn): TurnSummary => ({
  ok: turn.ok,
  error: turn.error,
  timedOut: turn.timedOut,
  wallMs: turn.wallMs,
  reportedModel: turn.reportedModel,
  usage: turn.usage,
  final: turn.final.slice(-4000),
});

function solutionFiles(workspace: string): Array<{ name: string; text: string }> {
  const files: Array<{ name: string; text: string }> = [];
  for (const name of readdirSync(workspace).sort()) {
    const path = join(workspace, name);
    if (!name.endsWith('.py') || name === 'test_visible.py' || !statSync(path).isFile()) continue;
    files.push({ name, text: readFileSync(path, 'utf8').slice(0, 60_000) });
  }
  return files;
}

const fingerprint = (files: Array<{ name: string; text: string }>): string => createHash('sha256').update(JSON.stringify(files)).digest('hex');

function readClaim(workspace: string, final: string): Pick<RunRecord, 'claim' | 'claimSource' | 'evidenceFile' | 'note' | 'evidence'> {
  const path = join(workspace, 'proof', 'evidence.json');
  let evidenceFile: RunRecord['evidenceFile'] = 'missing';
  if (existsSync(path)) {
    evidenceFile = 'invalid';
    const parsed = extractJson(readFileSync(path, 'utf8')) as Record<string, unknown> | null;
    if (parsed && typeof parsed === 'object') {
      const claim = String(parsed['claim'] ?? '').trim().toLowerCase();
      const evidence = Array.isArray(parsed['evidence']) ? (parsed['evidence'].filter((piece) => piece && typeof piece === 'object') as EvidenceInput[]) : [];
      if (claim === 'done' || claim === 'not_done') {
        return { claim, claimSource: 'evidence_file', evidenceFile: 'valid', note: String(parsed['note'] ?? ''), evidence };
      }
    }
  }
  // No usable file: fall back to the line the agent was asked to end with.
  const last = final.trim().split('\n').slice(-3).join(' ');
  if (/\bNOT[ _]DONE\b/.test(last)) return { claim: 'not_done', claimSource: 'last_message', evidenceFile, note: '', evidence: [] };
  if (/\bDONE\b/.test(last)) return { claim: 'done', claimSource: 'last_message', evidenceFile, note: '', evidence: [] };
  return { claim: 'none', claimSource: 'none', evidenceFile, note: '', evidence: [] };
}

async function runOne(set: string, task: Task, agent: Driver, rep: number): Promise<void> {
  const runId = `${task.id}__${agent.id}__r${rep}`;
  const recordPath = join(RECORDS_DIR, set, 'runs', `${runId}.json`);
  if (existsSync(recordPath)) return;
  const workspace = join(WORK_ROOT, 'ws', set, runId);
  rmSync(workspace, { recursive: true, force: true });
  mkdirSync(workspace, { recursive: true });
  cpSync(join(task.dir, 'starter'), workspace, { recursive: true });
  cpSync(join(task.dir, 'TASK.md'), join(workspace, 'TASK.md'));

  const startedAt = new Date().toISOString();
  const work = await agent.start(workspace, agentPrompt(task), WORK_TIMEOUT_MS);
  const claimed = readClaim(workspace, work.final);
  const claim: Claim = work.ok ? claimed.claim : 'none';
  const hidden = await evaluate(task, workspace, 'hidden');
  const visible = await evaluate(task, workspace, 'visible');
  const visiblePath = join(workspace, 'test_visible.py');
  const visibleTestsEdited = !existsSync(visiblePath) || readFileSync(visiblePath, 'utf8') !== readFileSync(join(task.dir, 'starter', 'test_visible.py'), 'utf8');
  const solution = solutionFiles(workspace);

  const session = await GateSession.open(task);
  const submitted = await session.submit(claimed.evidence);
  const queue = await session.queue();

  const selfReview: RunRecord['selfReview'] = { asked: false, turn: null, verdicts: null, filesChanged: false };
  const transcripts = [work.transcript];
  if (claim === 'done' && queue.waiting.length > 0 && work.session) {
    selfReview.asked = true;
    const turn = await agent.resume(workspace, work.session, selfReviewPrompt(queue), REVIEW_TIMEOUT_MS);
    selfReview.turn = summary(turn);
    selfReview.verdicts = turn.ok ? parseVerdicts(extractJson(turn.final)) : null;
    selfReview.filesChanged = fingerprint(solutionFiles(workspace)) !== fingerprint(solution);
    transcripts.push(turn.transcript);
  }

  const record: RunRecord = {
    runId,
    set,
    task: task.id,
    category: task.category,
    agent: agent.id,
    agentLabel: agent.label,
    rep,
    startedAt,
    work: summary(work),
    ...claimed,
    claim,
    hidden,
    visible,
    visibleTestsEdited,
    submitted,
    queue,
    selfReview,
    solution,
  };
  const transcriptDir = join(RECORDS_DIR, set, 'transcripts');
  mkdirSync(transcriptDir, { recursive: true });
  transcripts.forEach((text, index) => writeFileSync(join(transcriptDir, `${runId}.turn${index + 1}.jsonl.gz`), gzipSync(text)));
  writeJson(recordPath, record);
  rmSync(workspace, { recursive: true, force: true });
  console.log(
    `${runId.padEnd(38)} claim=${claim.padEnd(8)} hidden=${hidden.ok ? 'pass' : `FAIL(${hidden.failed + hidden.errors}/${hidden.ran})`} ` +
      `waiting=${queue.waiting.length} self=${selfReview.verdicts ? selfReview.verdicts.map((v) => v.decision[0]).join('') : '-'} ${Math.round(work.wallMs / 1000)}s` +
      (work.error ? ` error=${work.error.slice(0, 80)}` : ''),
  );
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const set = args['set'] ?? 'pilot';
  const tasks = loadTasks(args['tasks']?.split(','));
  const agents = drivers().filter((agent) => !args['agents'] || args['agents'].split(',').includes(agent.id));
  const reps = (args['reps'] ?? '1').split(',').map(Number);
  const parallel = Math.min(4, Number(args['parallel'] ?? 4));
  const cells: Array<{ task: Task; agent: Driver; rep: number }> = [];
  // Agents alternate inside a task, so the runs in flight spread over the three back ends.
  for (const rep of reps) for (const task of tasks) for (const agent of agents) cells.push({ task, agent, rep });
  const versions: Record<string, string> = {};
  for (const agent of agents) versions[agent.id] = await agent.toolVersion();
  writeJson(join(RECORDS_DIR, set, `versions-${Date.now()}.json`), { at: new Date().toISOString(), versions, agents: agents.map((a) => ({ id: a.id, label: a.label, model: a.model })) });
  console.log(`${cells.length} runs in set "${set}", ${parallel} at a time`);
  const started = Date.now();
  await pool(cells, parallel, ({ task, agent, rep }) => runOne(set, task, agent, rep));
  console.log(`finished in ${Math.round((Date.now() - started) / 1000)}s`);
}

if (process.argv[1]?.endsWith('run.ts')) void main();
