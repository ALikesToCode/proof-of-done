// Diagnostic, not part of the benchmark: adds one truthful piece of evidence for c2
// (the test file's SHA-256 before and after, as the harness itself measured it) to each
// finished run, and asks the same Haiku reviewer again with the same instructions.
//
//   npx tsx study/diagnostic-2026-11-26/add_hash_and_review.mts
//
// It writes one file per run under POD_DIAGNOSTIC_OUT. results.json was built from those
// files and from the benchmark's own reviews of the same runs.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const H = fileURLToPath(new URL('../../benchmark/harness', import.meta.url));
const { reviewers } = await import(`${H}/agents.ts`);
const { GateSession, gateAfterReview, parseVerdicts } = await import(`${H}/gate.ts`);
const { RECORDS_DIR, extractJson, loadTasks, pool, readJson } = await import(`${H}/lib.ts`);
const { reviewerPrompt, verifierSystemPrompt } = await import(`${H}/prompts.ts`);

const OUT = process.env.POD_DIAGNOSTIC_OUT ?? '/tmp/pod-study/diagnostic-2026-11-26';
mkdirSync(OUT, { recursive: true });
const tasks = new Map(loadTasks().map((t: any) => [t.id, t]));
const haiku = reviewers().find((r: any) => r.id === 'claude-haiku');
const system = verifierSystemPrompt();
const dir = join(RECORDS_DIR, 'full', 'runs');
const limit = Number(process.env.LIMIT ?? 0);
let runs = readdirSync(dir).filter((n) => n.endsWith('.json')).sort().map((n) => readJson(join(dir, n)) as any)
  .filter((r) => r.rep === 1 && r.claim === 'done' && r.hidden.ok && r.visibleTestsEdited === false && (r.queue?.waiting?.length ?? 0) > 0);
if (limit) runs = runs.filter((_, i) => i % Math.ceil(runs.length / limit) === 0);
const open = runs.filter((r) => !existsSync(join(OUT, `${r.runId}.json`)));
console.log(`${runs.length} finished runs, ${open.length} to ask`);
let done = 0;
await pool(open, 4, async (run: any) => {
  const task = tasks.get(run.task) as any;
  const sha = createHash('sha256').update(readFileSync(join(task.dir, 'starter', 'test_visible.py'))).digest('hex');
  const extra = {
    criterion: 'c2', kind: 'other',
    summary: 'The provided test file matched its pre-edit SHA-256 digest.',
    excerpt: `Before implementation: ${sha}  test_visible.py\nAfter testing: ${sha}  test_visible.py`,
  };
  const evidence = [...run.evidence, extra];
  const session = await GateSession.open(task);
  const outcomes = await session.submit(evidence);
  const queue = await session.queue();
  const turn = await haiku.ask(system, reviewerPrompt(queue), 5 * 60_000);
  const verdicts = turn.ok ? parseVerdicts(extractJson(turn.final)) : null;
  const { gate, refusals } = await gateAfterReview(task, evidence, verdicts);
  writeFileSync(join(OUT, `${run.runId}.json`), JSON.stringify({ runId: run.runId, agent: run.agent, task: run.task, outcomes, ok: turn.ok, error: turn.error, verdicts, refusals, gate, usage: turn.usage }, null, 1));
  done++;
  if (done % 10 === 0 || !turn.ok) console.log(`${done}/${open.length} ${run.runId}: ${verdicts ? (gate.pass ? 'PASS' : 'no') : 'no usable answer ' + (turn.error ?? '')}`);
});
console.log('finished');
