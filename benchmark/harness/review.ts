/**
 * Asks reviewers for verdicts on the evidence of finished runs and records the app's
 * gate answer after each review.
 *
 *   npx tsx benchmark/harness/review.ts --set pilot [--asks 1] [--parallel 4] [--reps 1] [--tasks a,b]
 *
 * For every run that said done and has evidence waiting:
 *   - every reviewer model judges the record in a fresh context (variant `record`),
 *   - the assigned independent reviewer also judges it with the source files (variant `source`).
 * `--asks 3` asks each `record` review three times, to measure how much a verdict moves.
 * A review whose file exists is skipped.
 */
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { Driver, INDEPENDENT_REVIEWER, Turn, reviewers as reviewerDrivers } from './agents';
import { GateAnswer, ParsedVerdict, gateAfterReview, parseVerdicts } from './gate';
import { RECORDS_DIR, extractJson, loadTasks, parseArgs, pool, readJson, writeJson } from './lib';
import { reviewerPrompt, verifierSystemPrompt } from './prompts';
import type { RunRecord } from './run';

const TIMEOUT_MS = 5 * 60_000;

export type Variant = 'record' | 'source';

export interface ReviewRecord {
  runId: string;
  reviewer: string;
  reviewerLabel: string;
  variant: Variant;
  ask: number;
  at: string;
  ok: boolean;
  error: string | null;
  wallMs: number;
  reportedModel: string | null;
  usage: Turn['usage'];
  answer: string;
  /** Null when the reviewer gave no usable answer. Then nothing was recorded and the evidence keeps waiting. */
  verdicts: ParsedVerdict[] | null;
  /** Verdicts the app refused, for example for an id that is not in the queue. */
  refusals: Array<{ label: string; error: string }>;
  gate: GateAnswer;
}

export const reviewPath = (set: string, runId: string, reviewer: string, variant: Variant, ask: number): string =>
  join(RECORDS_DIR, set, 'reviews', `${runId}__${reviewer}__${variant}__k${ask}.json`);

export function loadRuns(set: string): RunRecord[] {
  const dir = join(RECORDS_DIR, set, 'runs');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => readJson<RunRecord>(join(dir, name)));
}

/** A run needs reviews when the agent said done and some evidence passed the checks. */
export const needsReview = (run: RunRecord): boolean => run.claim === 'done' && ((run.queue as { waiting?: unknown[] }).waiting?.length ?? 0) > 0;

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const set = args['set'] ?? 'pilot';
  const asks = Number(args['asks'] ?? 1);
  const reps = args['reps']?.split(',').map(Number);
  const only = args['tasks']?.split(',');
  const tasks = new Map(loadTasks().map((task) => [task.id, task]));
  const reviewers = reviewerDrivers();
  const system = verifierSystemPrompt();
  const jobs: Array<{ run: RunRecord; reviewer: Driver; variant: Variant; ask: number }> = [];
  for (const run of loadRuns(set)) {
    if (!needsReview(run) || (reps && !reps.includes(run.rep)) || (only && !only.includes(run.task))) continue;
    for (const reviewer of reviewers) {
      for (let ask = 1; ask <= asks; ask++) jobs.push({ run, reviewer, variant: 'record', ask });
      if (INDEPENDENT_REVIEWER[run.agent] === reviewer.id) jobs.push({ run, reviewer, variant: 'source', ask: 1 });
    }
  }
  const open = jobs.filter((job) => !existsSync(reviewPath(set, job.run.runId, job.reviewer.id, job.variant, job.ask)));
  console.log(`${open.length} reviews to ask (${jobs.length - open.length} already recorded)`);
  const started = Date.now();
  let finished = 0;
  await pool(open, Math.min(4, Number(args['parallel'] ?? 4)), async ({ run, reviewer, variant, ask }) => {
    const task = tasks.get(run.task);
    if (!task) throw new Error(`No task ${run.task}`);
    const turn = await reviewer.ask(system, reviewerPrompt(run.queue, variant === 'source' ? run.solution : undefined), TIMEOUT_MS);
    const verdicts = turn.ok ? parseVerdicts(extractJson(turn.final)) : null;
    const { gate, refusals } = await gateAfterReview(task, run.evidence, verdicts);
    const record: ReviewRecord = {
      runId: run.runId,
      reviewer: reviewer.id,
      reviewerLabel: reviewer.label,
      variant,
      ask,
      at: new Date().toISOString(),
      ok: turn.ok,
      error: turn.error,
      wallMs: turn.wallMs,
      reportedModel: turn.reportedModel,
      usage: turn.usage,
      answer: turn.final.slice(-6000),
      verdicts,
      refusals,
      gate,
    };
    writeJson(reviewPath(set, run.runId, reviewer.id, variant, ask), record);
    finished++;
    if (finished % 10 === 0 || !turn.ok || verdicts === null) {
      console.log(`${finished}/${open.length} ${run.runId} by ${reviewer.id} (${variant}, ask ${ask}): ${verdicts ? `gate ${gate.pass ? 'PASS' : 'no'}` : `no usable answer${turn.error ? `: ${turn.error.slice(0, 100)}` : ''}`}`);
    }
  });
  console.log(`finished in ${Math.round((Date.now() - started) / 1000)}s`);
}

if (process.argv[1]?.endsWith('review.ts')) void main();
