/**
 * Sensitivity check on the truth. A hidden assertion can test a reading of TASK.md
 * that a careful reader could dispute. Each task may list such assertions in
 * `hidden/disputed.json`, with the reason. This script runs the hidden tests again
 * without them, against the solution files stored in each run record, for every run
 * that failed the hidden tests.
 *
 *   npx tsx benchmark/harness/rejudge.ts --set full
 *
 * Writes records/<set>/rejudge.json. The primary results never use it; score.ts
 * reports it as a second table.
 */
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { EVAL_DIR, RECORDS_DIR, loadTasks, parseArgs, readJson, runUnittest, writeJson } from './lib';
import { loadRuns } from './review';

export interface Disputed {
  /** Text in test_hidden.py, exactly as written there. */
  find: string;
  /** What replaces it. Empty removes it. */
  replace: string;
  /** Why a careful reader of TASK.md could disagree with the assertion. */
  reason: string;
}

async function main(): Promise<void> {
  const set = parseArgs(process.argv.slice(2))['set'] ?? 'full';
  const tasks = new Map(loadTasks().map((task) => [task.id, task]));
  const out: Record<string, { ok: boolean; failing: string[]; removed: number }> = {};
  mkdirSync(EVAL_DIR, { recursive: true });
  for (const run of loadRuns(set)) {
    if (run.hidden.ok) continue;
    const task = tasks.get(run.task);
    if (!task) throw new Error(`No task ${run.task}`);
    const disputedPath = join(task.dir, 'hidden', 'disputed.json');
    if (!existsSync(disputedPath)) continue;
    let tests = readFileSync(join(task.dir, 'hidden', 'test_hidden.py'), 'utf8');
    const disputed = readJson<Disputed[]>(disputedPath);
    for (const entry of disputed) {
      if (!tests.includes(entry.find)) throw new Error(`${task.id}: disputed text not found: ${entry.find}`);
      tests = tests.split(entry.find).join(entry.replace);
    }
    const dir = mkdtempSync(join(EVAL_DIR, `rejudge-${task.id}-`));
    try {
      for (const file of run.solution) writeFileSync(join(dir, file.name), file.text);
      writeFileSync(join(dir, 'test_hidden.py'), tests);
      // The reference solution must still pass what is left.
      const result = await runUnittest(dir, 'test_hidden');
      out[run.runId] = { ok: result.ok, failing: result.failing, removed: disputed.length };
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
  // Guard: the reference solution passes each reduced test file.
  for (const task of tasks.values()) {
    const disputedPath = join(task.dir, 'hidden', 'disputed.json');
    if (!existsSync(disputedPath)) continue;
    let tests = readFileSync(join(task.dir, 'hidden', 'test_hidden.py'), 'utf8');
    for (const entry of readJson<Disputed[]>(disputedPath)) tests = tests.split(entry.find).join(entry.replace);
    const dir = mkdtempSync(join(EVAL_DIR, `rejudge-ref-${task.id}-`));
    try {
      cpSync(join(task.dir, 'reference'), dir, { recursive: true });
      writeFileSync(join(dir, 'test_hidden.py'), tests);
      const result = await runUnittest(dir, 'test_hidden');
      if (!result.ok) throw new Error(`${task.id}: the reference fails the reduced hidden tests: ${result.tail}`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
  writeJson(join(RECORDS_DIR, set, 'rejudge.json'), out);
  const flipped = Object.entries(out).filter(([, value]) => value.ok);
  console.log(`${Object.keys(out).length} failing runs judged again, ${flipped.length} pass without the disputed assertions: ${flipped.map(([id]) => id).join(', ')}`);
}

void main();
