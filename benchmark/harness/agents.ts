/**
 * The agents under test and the reviewers. Each driver can start a coding session in
 * a workspace, add one turn to that session, and answer a single question with no
 * tools (the reviewer's job).
 *
 *   claude   the `claude` command-line tool, non-interactive, user settings off
 *   codex    the `codex` command-line tool, non-interactive, with a configuration
 *            folder that holds only the login
 *   gateway  a model behind MultiLLM-Proxy, driven by the small tool loop in this file
 *
 * Coding sessions run inside `bwrap` with the benchmark folder replaced by an empty
 * one, so no agent can read the hidden tests or the records.
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { WORK_ROOT, masked, run } from './lib';

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  /** Model requests in the turn, where the tool reports them. */
  requests: number | null;
  /** A cost figure the tool or the gateway reported. Null when it reports none. See the write-up for what each one means. */
  reportedCostUsd: number | null;
}

export interface Turn {
  ok: boolean;
  final: string;
  session: string | null;
  /** The model name the tool or the gateway reported, not the one asked for. */
  reportedModel: string | null;
  usage: Usage;
  wallMs: number;
  timedOut: boolean;
  error: string | null;
  /** Raw output of the tool, for the audit. */
  transcript: string;
}

export interface Driver {
  id: string;
  /** Tool and model in words, for tables. */
  label: string;
  model: string;
  toolVersion(): Promise<string>;
  start(cwd: string, prompt: string, timeoutMs: number): Promise<Turn>;
  resume(cwd: string, session: string, prompt: string, timeoutMs: number): Promise<Turn>;
  ask(system: string, user: string, timeoutMs: number): Promise<Turn>;
}

const emptyUsage = (): Usage => ({ inputTokens: 0, outputTokens: 0, cachedInputTokens: 0, requests: null, reportedCostUsd: null });
const number = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

function lines(text: string): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [];
  for (const line of text.split('\n')) {
    if (!line.startsWith('{')) continue;
    try {
      out.push(JSON.parse(line) as Record<string, unknown>);
    } catch {
      // not a JSON line
    }
  }
  return out;
}

function scratchDir(): string {
  mkdirSync(join(WORK_ROOT, 'ask'), { recursive: true });
  return mkdtempSync(join(WORK_ROOT, 'ask', 'q-'));
}

// ---------------------------------------------------------------- claude

/** Variables the parent session sets that would tie a child `claude` to it. */
const CLAUDE_PARENT_VARS = [
  'CLAUDE_CODE_CHILD_SESSION',
  'CLAUDE_CODE_MESSAGING_SOCKET',
  'CLAUDE_CODE_MESSAGING_TOKEN',
  'CLAUDE_CODE_SESSION_ID',
  'CLAUDE_CODE_CHILD_NOTES_DIR',
  'CLAUDE_CODE_ENTRYPOINT',
  'CLAUDE_CODE_SESSION_ATTENDED',
  'CLAUDE_CODE_AUTO_MODE_SERVER',
  'CLAUDE_CODE_AUTO_MODE_MODEL',
  'CLAUDE_EFFORT',
  'CLAUDECODE',
  'CLAUDE_PID',
  'CLAUDE_AGENT_SDK_VERSION',
];

function claudeEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const name of CLAUDE_PARENT_VARS) delete env[name];
  return env;
}

function claudeTurn(raw: { stdout: string; stderr: string; timedOut: boolean; wallMs: number; code: number | null }): Turn {
  const events = lines(raw.stdout);
  const result = [...events].reverse().find((event) => event['type'] === 'result') ?? (events.length === 1 ? events[0] : undefined);
  const usage = (result?.['usage'] ?? {}) as Record<string, unknown>;
  const models = Object.keys((result?.['modelUsage'] ?? {}) as Record<string, unknown>);
  const ok = !!result && result['is_error'] !== true && !raw.timedOut;
  return {
    ok,
    final: typeof result?.['result'] === 'string' ? (result['result'] as string) : '',
    session: typeof result?.['session_id'] === 'string' ? (result['session_id'] as string) : null,
    reportedModel: models.join('+') || null,
    usage: {
      inputTokens: number(usage['input_tokens']) + number(usage['cache_creation_input_tokens']) + number(usage['cache_read_input_tokens']),
      outputTokens: number(usage['output_tokens']),
      cachedInputTokens: number(usage['cache_read_input_tokens']),
      requests: typeof result?.['num_turns'] === 'number' ? (result['num_turns'] as number) : null,
      reportedCostUsd: typeof result?.['total_cost_usd'] === 'number' ? (result['total_cost_usd'] as number) : null,
    },
    wallMs: raw.wallMs,
    timedOut: raw.timedOut,
    error: ok ? null : raw.timedOut ? 'timed out' : (raw.stderr.trim().slice(-500) || `exit ${raw.code}`),
    transcript: raw.stdout,
  };
}

export function claudeDriver(id: string, model: string): Driver {
  const base = ['-p', '--model', model, '--setting-sources', '', '--strict-mcp-config'];
  const coding = [...base, '--output-format', 'stream-json', '--verbose', '--permission-mode', 'bypassPermissions'];
  return {
    id,
    label: `claude CLI, ${model}`,
    model,
    async toolVersion() {
      return (await run('claude', ['--version'])).stdout.trim();
    },
    async start(cwd, prompt, timeoutMs) {
      const { command, args } = masked('claude', coding);
      return claudeTurn(await run(command, args, { cwd, env: claudeEnv(), timeoutMs, input: prompt }));
    },
    async resume(cwd, session, prompt, timeoutMs) {
      const { command, args } = masked('claude', [...coding, '--resume', session]);
      return claudeTurn(await run(command, args, { cwd, env: claudeEnv(), timeoutMs, input: prompt }));
    },
    async ask(system, user, timeoutMs) {
      const cwd = scratchDir();
      try {
        const args = [...base, '--system-prompt', system, '--tools', '', '--output-format', 'json', '--no-session-persistence'];
        return claudeTurn(await run('claude', args, { cwd, env: claudeEnv(), timeoutMs, input: user }));
      } finally {
        rmSync(cwd, { recursive: true, force: true });
      }
    },
  };
}

// ---------------------------------------------------------------- codex

/** A configuration folder with the owner's login and nothing else: no global instructions, skills, hooks or memories. */
export function codexHome(): string {
  const home = join(WORK_ROOT, 'codex-home');
  if (!existsSync(join(home, 'auth.json'))) {
    mkdirSync(home, { recursive: true });
    symlinkSync(join(process.env['CODEX_HOME'] ?? join(homedir(), '.codex'), 'auth.json'), join(home, 'auth.json'));
  }
  return home;
}

function codexTurn(raw: { stdout: string; stderr: string; timedOut: boolean; wallMs: number; code: number | null }, model: string): Turn {
  const events = lines(raw.stdout);
  let final = '';
  let session: string | null = null;
  let failure: string | null = null;
  const usage = emptyUsage();
  usage.requests = 0;
  for (const event of events) {
    if (event['type'] === 'thread.started' && typeof event['thread_id'] === 'string') session = event['thread_id'];
    const item = event['item'] as Record<string, unknown> | undefined;
    if (event['type'] === 'item.completed' && item?.['type'] === 'agent_message' && typeof item['text'] === 'string') final = item['text'];
    if (event['type'] === 'turn.completed') {
      const reported = (event['usage'] ?? {}) as Record<string, unknown>;
      usage.inputTokens += number(reported['input_tokens']);
      usage.outputTokens += number(reported['output_tokens']);
      usage.cachedInputTokens += number(reported['cached_input_tokens']);
      usage.requests += 1;
    }
    if (event['type'] === 'turn.failed' || event['type'] === 'error') failure = JSON.stringify(event).slice(0, 500);
  }
  const ok = !raw.timedOut && raw.code === 0 && usage.requests > 0;
  return {
    ok,
    final,
    session,
    reportedModel: model,
    usage: { ...usage, requests: null },
    wallMs: raw.wallMs,
    timedOut: raw.timedOut,
    error: ok ? null : raw.timedOut ? 'timed out' : (failure ?? (raw.stderr.trim().slice(-500) || `exit ${raw.code}`)),
    transcript: raw.stdout,
  };
}

export function codexDriver(id: string, model: string, effort: string): Driver {
  const settings = ['--json', '--skip-git-repo-check', '-m', model, '-c', `model_reasoning_effort=${effort}`];
  const env = (): NodeJS.ProcessEnv => ({ ...process.env, CODEX_HOME: codexHome() });
  return {
    id,
    label: `codex CLI, ${model}, reasoning effort ${effort}`,
    model,
    async toolVersion() {
      return (await run('codex', ['--version'])).stdout.trim();
    },
    async start(cwd, prompt, timeoutMs) {
      const { command, args } = masked('codex', ['exec', ...settings, '--sandbox', 'workspace-write', '-C', cwd, '-']);
      return codexTurn(await run(command, args, { cwd, env: env(), timeoutMs, input: prompt }), model);
    },
    async resume(cwd, session, prompt, timeoutMs) {
      const { command, args } = masked('codex', ['exec', 'resume', ...settings, session, '-']);
      return codexTurn(await run(command, args, { cwd, env: env(), timeoutMs, input: prompt }), model);
    },
    async ask(system, user, timeoutMs) {
      const cwd = scratchDir();
      try {
        // codex takes no system prompt, so the reviewer's instructions lead the message.
        const args = ['exec', ...settings, '--sandbox', 'read-only', '--ephemeral', '-C', cwd, '-'];
        return codexTurn(await run('codex', args, { cwd, env: env(), timeoutMs, input: `${system}\n\n${user}` }), model);
      } finally {
        rmSync(cwd, { recursive: true, force: true });
      }
    },
  };
}

// ---------------------------------------------------------------- gateway

const GATEWAY_URL = process.env['MULTILLM_BASE_URL'] ?? 'https://multillm-proxy.cserules.workers.dev';

function gatewayKey(): string {
  const fromEnv = process.env['MULTILLM_API_KEY'];
  if (fromEnv) return fromEnv;
  const file = join(homedir(), '.config', 'multillm', 'api-key');
  if (existsSync(file)) return readFileSync(file, 'utf8').trim();
  throw new Error('No MultiLLM key: set MULTILLM_API_KEY or put it in ~/.config/multillm/api-key');
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }>;
  tool_call_id?: string;
}

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'run_shell',
      description: 'Run a bash command in the working directory and return its output and exit code. Times out after 60 seconds.',
      parameters: { type: 'object', properties: { command: { type: 'string' } }, required: ['command'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read a text file. The path is relative to the working directory.',
      parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Create or overwrite a text file with the given content. The path is relative to the working directory.',
      parameters: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'] },
    },
  },
];

const LOOP_SYSTEM =
  'You are a coding agent. You work in one directory through three tools: run_shell, read_file and write_file. Use them to do the work, then answer in plain text with no tool call when you have finished.';
const MAX_STEPS = 60;
const OUTPUT_LIMIT = 8000;

function inside(cwd: string, path: string): string | null {
  const full = resolve(cwd, path);
  return full === cwd || full.startsWith(`${cwd}/`) ? full : null;
}

async function callTool(cwd: string, name: string, rawArguments: string): Promise<string> {
  let input: Record<string, unknown>;
  try {
    input = JSON.parse(rawArguments || '{}') as Record<string, unknown>;
  } catch {
    return 'error: the arguments were not valid JSON';
  }
  if (name === 'run_shell') {
    const { command, args } = masked('bash', ['-c', String(input['command'] ?? '')]);
    const result = await run(command, args, { cwd, timeoutMs: 60_000 });
    const output = (result.stdout + result.stderr).slice(-OUTPUT_LIMIT);
    return `${output}\n[exit code ${result.timedOut ? 'none, timed out after 60 seconds' : result.code}]`;
  }
  const path = inside(cwd, String(input['path'] ?? ''));
  if (!path) return 'error: the path is outside the working directory';
  if (name === 'read_file') {
    try {
      return readFileSync(path, 'utf8').slice(0, 40_000);
    } catch (error) {
      return `error: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
  if (name === 'write_file') {
    try {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, String(input['content'] ?? ''));
      return 'written';
    } catch (error) {
      return `error: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
  return `error: no tool named ${name}`;
}

interface Completion {
  message: ChatMessage;
  model: string | null;
  cost: number | null;
  usage: Record<string, unknown>;
}

async function complete(model: string, messages: ChatMessage[], withTools: boolean): Promise<Completion> {
  const body = JSON.stringify({ model, messages, max_tokens: 8000, ...(withTools ? { tools: TOOLS } : {}) });
  let lastError = '';
  // Retries: a rate limit is waited out, and a failed request is sent again. A second
  // request can cost a second generation, which the usage figures then include.
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const response = await fetch(`${GATEWAY_URL}/v1/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${gatewayKey()}`, 'Content-Type': 'application/json' },
        body,
        signal: AbortSignal.timeout(300_000),
      });
      if (!response.ok) {
        lastError = `HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`;
        if (response.status === 429 || response.status >= 500) {
          const wait = response.status === 429 ? 20_000 * (attempt + 1) : 5000;
          await new Promise((done) => setTimeout(done, wait));
          continue;
        }
        break;
      }
      const data = (await response.json()) as { choices?: Array<{ message?: ChatMessage }>; usage?: Record<string, unknown>; model?: string };
      const message = data.choices?.[0]?.message;
      if (!message) {
        lastError = 'the gateway returned no message';
        continue;
      }
      const cost = Number(response.headers.get('x-multillm-estimated-cost-usd'));
      return {
        message: { role: 'assistant', content: message.content ?? null, ...(message.tool_calls?.length ? { tool_calls: message.tool_calls.map((call) => ({ id: call.id, type: 'function', function: { name: call.function.name, arguments: call.function.arguments } })) } : {}) },
        model: response.headers.get('x-multillm-model') ?? response.headers.get('x-multillm-auto-selected-model') ?? data.model ?? null,
        cost: Number.isFinite(cost) && response.headers.has('x-multillm-estimated-cost-usd') ? cost : null,
        usage: data.usage ?? {},
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }
  throw new Error(lastError);
}

async function loop(model: string, cwd: string | null, messages: ChatMessage[], sessionFile: string | null, timeoutMs: number): Promise<Turn> {
  const started = Date.now();
  const usage = emptyUsage();
  usage.requests = 0;
  const models = new Set<string>();
  const log: string[] = [];
  let final = '';
  let error: string | null = null;
  let timedOut = false;
  let costKnown = true;
  try {
    for (let step = 0; ; step++) {
      if (Date.now() - started > timeoutMs) {
        timedOut = true;
        error = 'timed out';
        break;
      }
      if (step >= MAX_STEPS) {
        error = `stopped after ${MAX_STEPS} model requests`;
        break;
      }
      const completion = await complete(model, messages, cwd !== null);
      usage.requests += 1;
      usage.inputTokens += number(completion.usage['prompt_tokens']);
      usage.outputTokens += number(completion.usage['completion_tokens']);
      const details = (completion.usage['prompt_tokens_details'] ?? {}) as Record<string, unknown>;
      usage.cachedInputTokens += number(details['cached_tokens']);
      if (completion.cost === null) costKnown = false;
      else usage.reportedCostUsd = (usage.reportedCostUsd ?? 0) + completion.cost;
      if (completion.model) models.add(completion.model);
      messages.push(completion.message);
      log.push(JSON.stringify({ type: 'assistant', model: completion.model, message: completion.message }));
      const calls = completion.message.tool_calls ?? [];
      if (calls.length === 0 || cwd === null) {
        final = completion.message.content ?? '';
        break;
      }
      for (const call of calls) {
        const output = await callTool(cwd, call.function.name, call.function.arguments);
        messages.push({ role: 'tool', tool_call_id: call.id, content: output });
        log.push(JSON.stringify({ type: 'tool', name: call.function.name, output }));
      }
    }
  } catch (caught) {
    error = caught instanceof Error ? caught.message : String(caught);
  }
  if (!costKnown) usage.reportedCostUsd = null;
  if (sessionFile) {
    mkdirSync(dirname(sessionFile), { recursive: true });
    writeFileSync(sessionFile, JSON.stringify(messages));
  }
  return {
    ok: error === null,
    final,
    session: sessionFile,
    reportedModel: [...models].join('+') || null,
    usage,
    wallMs: Date.now() - started,
    timedOut,
    error,
    transcript: log.join('\n'),
  };
}

export function gatewayDriver(id: string, model: string): Driver {
  return {
    id,
    label: `benchmark tool loop, ${model} through MultiLLM-Proxy`,
    model,
    async toolVersion() {
      return 'benchmark/harness/agents.ts tool loop';
    },
    async start(cwd, prompt, timeoutMs) {
      mkdirSync(join(WORK_ROOT, 'sessions'), { recursive: true });
      const sessionFile = join(mkdtempSync(join(WORK_ROOT, 'sessions', 's-')), 'messages.json');
      return loop(model, cwd, [{ role: 'system', content: LOOP_SYSTEM }, { role: 'user', content: prompt }], sessionFile, timeoutMs);
    },
    async resume(cwd, session, prompt, timeoutMs) {
      const messages = JSON.parse(readFileSync(session, 'utf8')) as ChatMessage[];
      messages.push({ role: 'user', content: prompt });
      return loop(model, cwd, messages, session, timeoutMs);
    },
    async ask(system, user, timeoutMs) {
      return loop(model, null, [{ role: 'system', content: system }, { role: 'user', content: user }], null, timeoutMs);
    },
  };
}

// ---------------------------------------------------------------- the line-up

/** The models that review. They are also the first three agents under test. */
export function reviewers(): Driver[] {
  return [
    claudeDriver('claude-haiku', process.env['POD_BENCH_CLAUDE_MODEL'] ?? 'claude-haiku-5-5'),
    codexDriver('codex-astra', process.env['POD_BENCH_CODEX_MODEL'] ?? 'gpt-6.2-astra', process.env['POD_BENCH_CODEX_EFFORT'] ?? 'low'),
    gatewayDriver('loop-glm', process.env['POD_BENCH_GATEWAY_MODEL'] ?? 'auto:glm-5.2'),
  ];
}

/** The agents under test: the three reviewers' models, and the smaller models added after the pilot (see PROTOCOL.md). */
export function drivers(): Driver[] {
  return [
    ...reviewers(),
    claudeDriver('claude-haiku45', 'claude-haiku-4-5-20251001'),
    codexDriver('codex-luna', 'gpt-5.6-luna', 'low'),
  ];
}

export function driver(id: string): Driver {
  const found = drivers().find((candidate) => candidate.id === id);
  if (!found) throw new Error(`No agent ${id}`);
  return found;
}

/**
 * Who gives the independent verdict on whose work. Fixed before the runs it applies
 * to: the reviewer is always another vendor's model than the one that did the work.
 */
export const INDEPENDENT_REVIEWER: Record<string, string> = {
  'claude-haiku': 'codex-astra',
  'codex-astra': 'claude-haiku',
  'loop-glm': 'claude-haiku',
  'claude-haiku45': 'codex-astra',
  'codex-luna': 'claude-haiku',
};
