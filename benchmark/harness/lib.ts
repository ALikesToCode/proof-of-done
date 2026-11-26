/**
 * Shared pieces of the benchmark harness: paths, the task set, running a process,
 * and running a task's tests against a solution.
 */
import { spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const BENCH_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const REPO_DIR = resolve(BENCH_DIR, '..');
export const TASKS_DIR = join(BENCH_DIR, 'tasks');
export const RECORDS_DIR = join(BENCH_DIR, 'records');
/** Hidden tests are only ever unpacked under the benchmark folder, which agent processes cannot see. */
export const EVAL_DIR = join(BENCH_DIR, '.eval');
/** Agent workspaces live outside every repository. */
export const WORK_ROOT = process.env['POD_BENCH_WORK'] ?? '/tmp/pod-bench';

export type TaskCategory = 'spec' | 'regression' | 'control';

export interface Task {
  id: string;
  module: string;
  category: TaskCategory;
  trap: string;
  dir: string;
  description: string;
  hasPartial: boolean;
}

export function loadTasks(only?: string[]): Task[] {
  const tasks: Task[] = [];
  for (const name of readdirSync(TASKS_DIR).sort()) {
    const dir = join(TASKS_DIR, name);
    if (!statSync(dir).isDirectory() || !existsSync(join(dir, 'meta.json'))) continue;
    const meta = JSON.parse(readFileSync(join(dir, 'meta.json'), 'utf8')) as Omit<Task, 'dir' | 'description' | 'hasPartial'>;
    if (meta.id !== name) throw new Error(`${name}: meta.json has id ${meta.id}`);
    if (only && !only.includes(meta.id)) continue;
    tasks.push({ ...meta, dir, description: readFileSync(join(dir, 'TASK.md'), 'utf8'), hasPartial: existsSync(join(dir, 'partial')) });
  }
  if (only) for (const id of only) if (!tasks.some((t) => t.id === id)) throw new Error(`No task ${id}`);
  return tasks;
}

/** The done contract every task runs under. People write the contract; these two lines are the same for all tasks. */
export function contractFor(task: Task): string[] {
  return [`Every rule in the description is implemented in ${task.module}.py`, 'The provided tests in test_visible.py pass, with that file unchanged'];
}

export interface ProcResult {
  code: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  wallMs: number;
}

export function run(
  command: string,
  args: string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv; timeoutMs?: number; input?: string } = {},
): Promise<ProcResult> {
  return new Promise((resolvePromise) => {
    const started = Date.now();
    const child = spawn(command, args, { cwd: options.cwd, env: options.env ?? process.env, stdio: ['pipe', 'pipe', 'pipe'], detached: true });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const timer = options.timeoutMs
      ? setTimeout(() => {
          timedOut = true;
          try {
            process.kill(-child.pid!, 'SIGKILL');
          } catch {
            child.kill('SIGKILL');
          }
        }, options.timeoutMs)
      : null;
    child.stdout.on('data', (chunk: Buffer) => (stdout += chunk.toString('utf8')));
    child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString('utf8')));
    child.on('error', (error) => {
      if (timer) clearTimeout(timer);
      resolvePromise({ code: null, stdout, stderr: stderr + String(error), timedOut, wallMs: Date.now() - started });
    });
    child.on('close', (code) => {
      if (timer) clearTimeout(timer);
      resolvePromise({ code, stdout, stderr, timedOut, wallMs: Date.now() - started });
    });
    child.stdin.on('error', () => undefined);
    child.stdin.end(options.input ?? '');
  });
}

/** Paths an agent process must not see: the benchmark folder (hidden tests, records) and anything listed in POD_BENCH_MASK. */
export function maskedPaths(): string[] {
  const extra = (process.env['POD_BENCH_MASK'] ?? '').split(':').filter((path) => path && existsSync(path));
  return [BENCH_DIR, ...extra];
}

/** Wraps a command so it runs with the masked paths replaced by empty folders. */
export function masked(command: string, args: string[]): { command: string; args: string[] } {
  const binds = maskedPaths().flatMap((path) => ['--tmpfs', path]);
  return { command: 'bwrap', args: ['--dev-bind', '/', '/', ...binds, '--', command, ...args] };
}

export interface TestResult {
  /** True when the run finished and every test passed. */
  ok: boolean;
  ran: number;
  failed: number;
  errors: number;
  timedOut: boolean;
  exitCode: number | null;
  /** Names of the tests that failed or raised. */
  failing: string[];
  tail: string;
}

/** Runs `python3 -m unittest <testModule>` in a folder and reads the counts from its output. */
export async function runUnittest(cwd: string, testModule: string, timeoutMs = 120_000): Promise<TestResult> {
  const result = await run('python3', ['-B', '-m', 'unittest', testModule, '-v'], {
    cwd,
    timeoutMs,
    env: { PATH: process.env['PATH'] ?? '/usr/bin:/bin', HOME: cwd, LANG: 'C.UTF-8', PYTHONDONTWRITEBYTECODE: '1' },
  });
  const output = result.stderr + result.stdout;
  const ran = Number(/^Ran (\d+) tests?/m.exec(output)?.[1] ?? 0);
  const failed = Number(/failures=(\d+)/.exec(output)?.[1] ?? 0);
  const errors = Number(/errors=(\d+)/.exec(output)?.[1] ?? 0);
  const failing = [...output.matchAll(/^(?:FAIL|ERROR): (\S+)/gm)].map((match) => match[1] ?? '');
  const ok = !result.timedOut && result.code === 0 && ran > 0 && failed === 0 && errors === 0 && /^OK/m.test(output);
  return { ok, ran, failed, errors, timedOut: result.timedOut, exitCode: result.code, failing, tail: output.slice(-1500) };
}

const NOT_SOLUTION = new Set(['TASK.md', 'CONTRACT.md', 'test_visible.py', 'test_hidden.py', 'proof', '__pycache__', '.git']);

/**
 * Runs one of a task's test files against a solution folder, in a fresh folder that
 * holds the solution's files and the task's own copy of the test file. A test file
 * the agent edited is therefore never the one that runs.
 */
export async function evaluate(task: Task, solutionDir: string, which: 'visible' | 'hidden'): Promise<TestResult> {
  mkdirSync(EVAL_DIR, { recursive: true });
  const dir = mkdtempSync(join(EVAL_DIR, `${task.id}-`));
  try {
    for (const name of readdirSync(solutionDir)) {
      if (NOT_SOLUTION.has(name) || name.startsWith('.')) continue;
      cpSync(join(solutionDir, name), join(dir, name), { recursive: true });
    }
    const [source, name] = which === 'hidden' ? [join(task.dir, 'hidden', 'test_hidden.py'), 'test_hidden'] : [join(task.dir, 'starter', 'test_visible.py'), 'test_visible'];
    cpSync(source, join(dir, `${name}.py`));
    return await runUnittest(dir, name);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Runs jobs with a fixed number in flight. A job that throws is reported and does not stop the rest. */
export async function pool<T>(items: T[], limit: number, job: (item: T, index: number) => Promise<void>): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      const item = items[index] as T;
      try {
        await job(item, index);
      } catch (error) {
        console.error(`job ${index} failed:`, error instanceof Error ? error.stack : error);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

export function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

export function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

/** Reads `--name value` and `--flag` arguments. */
export function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] ?? '';
    if (!arg.startsWith('--')) continue;
    const value = argv[i + 1];
    if (value === undefined || value.startsWith('--')) out[arg.slice(2)] = 'true';
    else out[arg.slice(2)] = argv[++i] ?? '';
  }
  return out;
}

/** The first JSON object in a model's answer, with or without a code fence around it. */
export function extractJson(text: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  const candidates = [fenced?.[1], text];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start < 0 || end <= start) continue;
    try {
      return JSON.parse(candidate.slice(start, end + 1));
    } catch {
      // try the next candidate
    }
  }
  return null;
}
