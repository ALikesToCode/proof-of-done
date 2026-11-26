/**
 * Checks the task set before any agent sees it. For every task:
 *   - the reference solution passes the visible and the hidden tests,
 *   - the starter fails the hidden tests,
 *   - a trap task's partial solution passes the visible tests and fails the hidden ones,
 *   - a control task has no partial solution.
 *
 * Run: npx tsx benchmark/harness/validate.ts
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { evaluate, loadTasks, parseArgs } from './lib';

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const tasks = loadTasks(args['tasks']?.split(','));
  let bad = 0;
  for (const task of tasks) {
    const problems: string[] = [];
    const reference = join(task.dir, 'reference');
    const referenceVisible = await evaluate(task, reference, 'visible');
    const referenceHidden = await evaluate(task, reference, 'hidden');
    if (!referenceVisible.ok) problems.push(`reference fails visible tests: ${referenceVisible.failing.join(', ') || referenceVisible.tail}`);
    if (!referenceHidden.ok) problems.push(`reference fails hidden tests: ${referenceHidden.failing.join(', ') || referenceHidden.tail}`);
    const starterHidden = await evaluate(task, join(task.dir, 'starter'), 'hidden');
    if (starterHidden.ok) problems.push('starter passes hidden tests');
    let partialNote = 'no partial';
    if (task.category === 'control') {
      if (task.hasPartial) problems.push('a control task must not have a partial solution');
    } else if (!existsSync(join(task.dir, 'partial'))) {
      problems.push('a trap task needs a partial solution');
    } else {
      const partialVisible = await evaluate(task, join(task.dir, 'partial'), 'visible');
      const partialHidden = await evaluate(task, join(task.dir, 'partial'), 'hidden');
      if (!partialVisible.ok) problems.push(`partial fails visible tests: ${partialVisible.failing.join(', ') || partialVisible.tail}`);
      if (partialHidden.ok) problems.push('partial passes hidden tests');
      partialNote = `partial fails ${partialHidden.failed + partialHidden.errors} of ${partialHidden.ran} hidden`;
    }
    if (task.description.length > 5500) problems.push('TASK.md is longer than the reviewer is shown (5500 characters)');
    bad += problems.length > 0 ? 1 : 0;
    console.log(
      `${problems.length > 0 ? 'FAIL' : 'ok  '} ${task.id.padEnd(16)} ${task.category.padEnd(10)} visible ${referenceVisible.ran}, hidden ${referenceHidden.ran}, ${partialNote}`,
    );
    for (const problem of problems) console.log(`       ${problem}`);
  }
  console.log(`${tasks.length} tasks, ${bad} with problems`);
  process.exitCode = bad > 0 ? 1 : 0;
}

void main();
