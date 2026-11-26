import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MCP_TOOLS, VERIFIER_TOOLS } from '../src/actions/tools';
import { extractCriteria } from '../src/core/extract';
import { openLocal } from '../src/local/app';
import { EXIT, HOOK_BLOCK, Io, run } from '../src/local/cli';
import { FileStore, STATE_VERSION, StoreError } from '../src/local/file-store';
import { markdownToAdf } from '../src/local/markdown';
import { PROTOCOL_VERSIONS, handleMessage, serve } from '../src/local/mcp-server';
import { TaskFolder, formatTask, parseTask, projectIdOf } from '../src/local/tasks';
import { AGENT_TOOL_DEFS } from '../src/local/tool-defs';
import { localWording } from '../src/local/wording';
import { entries } from './helpers/manifest';

let dir: string;
let root: string;
let clock: number;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'pod-local-'));
  root = join(dir, '.proof-of-done');
  clock = Date.UTC(2026, 10, 25, 9, 0, 0);
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

interface Result {
  code: number;
  out: string;
  err: string;
}

/** Runs one command. A person is at the keyboard unless the test says otherwise. */
async function pod(argv: string[], options: { as?: string; interactive?: boolean; env?: Record<string, string> } = {}): Promise<Result> {
  const out: string[] = [];
  const err: string[] = [];
  const io: Io = {
    out: (line) => out.push(line),
    err: (line) => err.push(line),
    cwd: dir,
    env: { POD_USER: options.as ?? 'sam', ...options.env },
    interactive: options.interactive ?? true,
    now: () => (clock += 1000),
  };
  const code = await run(argv, io);
  return { code, out: out.join('\n'), err: err.join('\n') };
}

const json = async <T>(argv: string[]): Promise<T> => JSON.parse((await pod([...argv, '--json'])).out) as T;

interface Shown {
  criteria: Array<{ id: string; text: string; state: string; evidence: Array<{ id: string; standing: string }> }>;
  gate: { pass: boolean; reason: string };
}

/** A task with a contract of two criteria. Returns the ids of the criteria. */
async function contract(): Promise<string[]> {
  await pod(['init']);
  await pod(['new', 'Export the audit log as CSV', '-c', 'All unit tests pass', '-c', 'Release notes are updated', '--assignee', 'dana']);
  await pod(['start', 'POD-1']);
  return (await json<Shown>(['show', 'POD-1'])).criteria.map((c) => c.id);
}

const server = () => ({ app: openLocal(root, () => (clock += 1000)), options: { owner: 'dana', version: 'test' } });

async function call(name: string, args: Record<string, unknown>): Promise<{ isError: boolean; body: Record<string, unknown> }> {
  const { app, options } = server();
  const answer = await handleMessage(app, options, { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } });
  const result = (answer as { result: { isError: boolean; content: Array<{ text: string }> } }).result;
  return { isError: result.isError, body: JSON.parse(result.content[0]!.text) as Record<string, unknown> };
}

describe('task files', () => {
  it('reads the criteria of a Markdown description the way the Jira app reads its own', () => {
    const doc = markdownToAdf(
      ['Some context.', '', '**Acceptance criteria:**', '', '- [ ] All unit tests pass', '- Export has a header row', '  1. also for an empty log', '', 'A note after the list.', '', '## Notes', '- not a criterion'].join(
        '\n',
      ),
    );
    expect(extractCriteria(doc).map((c) => c.text)).toEqual(['All unit tests pass', 'Export has a header row', 'also for an empty log']);
  });

  it('keeps a fenced block out of the lists around it', () => {
    const doc = markdownToAdf(['## Definition of done', '- Builds on main', '', '```', '- not a list', '```'].join('\n'));
    expect(doc.content?.map((node) => node.type)).toEqual(['heading', 'bulletList', 'codeBlock']);
  });

  it('writes a task and reads the same task back', () => {
    const task = parseTask(
      'POD-7',
      '---\nstatus: In Progress\nassignee: dana\nparent: POD-1\nlabels: a, b\ncreated: 2026-11-20T10:00:00.000Z\n---\n# Lock accounts\n\n## Acceptance criteria\n- Five failures lock the account\n',
      0,
    );
    expect(task).toMatchObject({ key: 'POD-7', projectKey: 'POD', summary: 'Lock accounts', status: 'in-progress', assignee: 'dana', parent: 'POD-1', labels: ['a', 'b'] });
    expect(parseTask('POD-7', formatTask(task), 0)).toEqual(task);
  });

  it('reads a file with no front matter as an open task', () => {
    expect(parseTask('POD-2', '# Just a title\n\nText.', 5)).toMatchObject({ status: 'todo', summary: 'Just a title', body: 'Text.', created: 5 });
  });

  it('reads a criterion that wraps onto the next line as one criterion, and keeps the ones after it', () => {
    const doc = markdownToAdf(['## Acceptance criteria', '- The exported report contains all', 'records matching the query.', '- No private records are exposed'].join('\n'));
    expect(extractCriteria(doc).map((c) => c.text)).toEqual(['The exported report contains all records matching the query.', 'No private records are exposed']);
  });

  it('dates a file written by hand from the file itself', () => {
    const at = Date.UTC(2026, 10, 24);
    expect(parseTask('POD-3', '# Written in an editor', at)).toMatchObject({ created: at, statusChanged: null });
    expect(parseTask('POD-3', '---\nstatus: done\n---\n# Closed in an editor', at)).toMatchObject({ created: at, statusChanged: at });
  });

  it('never gives two new tasks the same key', () => {
    const folder = new TaskFolder(join(root, 'tasks'));
    const blank = { summary: 'One', body: '', status: 'todo' as const, type: 'Task', assignee: null, parent: null, labels: [], created: 1, statusChanged: null };
    expect(folder.create('POD', blank).key).toBe('POD-1');
    // Another command took POD-2 between the look and the write.
    const next = folder.nextKey.bind(folder);
    let first = true;
    folder.nextKey = (project: string) => {
      const key = next(project);
      if (first) {
        first = false;
        writeFileSync(join(root, 'tasks', `${key}.md`), '# Taken by someone else\n');
      }
      return key;
    };
    expect(folder.create('POD', { ...blank, summary: 'Two' }).key).toBe('POD-3');
    expect(folder.get('POD-2')!.summary).toBe('Taken by someone else');
  });

  it('gives a project the same numeric id on every machine', () => {
    expect(projectIdOf('POD')).toBe(projectIdOf('pod'));
    expect(projectIdOf('POD')).toMatch(/^\d{1,18}$/);
    expect(projectIdOf('POD')).not.toBe(projectIdOf('PODS'));
  });
});

describe('the file store', () => {
  const file = () => join(root, 'state.json');
  const event = (id: string) => ({ id, projectId: '1', issueId: 'POD-1', type: 'test', at: 1, actorAccountId: null, channel: null, data: {} });

  it('keeps the rows of two writers that take turns', async () => {
    const a = new FileStore(file());
    const b = new FileStore(file());
    await Promise.all([a.insertEvent(event('a1')), b.insertEvent(event('b1')), a.insertEvent(event('a2')), b.insertEvent(event('b2'))]);
    expect((await a.listEvents('POD-1', 10)).map((e) => e.id).sort()).toEqual(['a1', 'a2', 'b1', 'b2']);
  });

  it('keeps every row when several processes write at once', async () => {
    mkdirSync(root, { recursive: true });
    const writer = join(dir, 'writer.ts');
    writeFileSync(
      writer,
      `import { FileStore } from ${JSON.stringify(join(__dirname, '../src/local/file-store'))};
       const store = new FileStore(process.argv[2]!);
       void (async () => {
         for (let i = 0; i < 25; i++) {
           await store.insertEvent({ id: process.argv[3] + '-' + i, projectId: '1', issueId: 'POD-1', type: 't', at: i, actorAccountId: null, channel: null, data: {} });
         }
       })();`,
    );
    const tsx = join(__dirname, '../node_modules/tsx/dist/cli.mjs');
    await Promise.all(
      ['a', 'b', 'c', 'd'].map(
        (name) =>
          new Promise<void>((resolve, reject) => {
            const child = spawn(process.execPath, [tsx, writer, file(), name], { stdio: 'inherit' });
            child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`writer ${name} exited with ${code}`))));
          }),
      ),
    );
    expect(new FileStore(file()).read().events).toHaveLength(100);
    expect(existsSync(`${file()}.lock`)).toBe(false);
  }, 30_000);

  it('takes over a lock that a dead process left behind', async () => {
    mkdirSync(`${file()}.lock`, { recursive: true });
    const old = new Date(Date.now() - 60_000);
    utimesSync(`${file()}.lock`, old, old);
    await new FileStore(file()).insertEvent(event('after'));
    expect(new FileStore(file()).read().events).toHaveLength(1);
  });

  it('refuses a file it cannot read, and leaves it as it is', async () => {
    mkdirSync(root, { recursive: true });
    writeFileSync(file(), '{ broken');
    await expect(new FileStore(file()).insertEvent(event('x'))).rejects.toBeInstanceOf(StoreError);
    expect(readFileSync(file(), 'utf8')).toBe('{ broken');
    expect(existsSync(`${file()}.lock`)).toBe(false);
  });

  it('refuses a store written by a newer version', () => {
    mkdirSync(root, { recursive: true });
    writeFileSync(file(), JSON.stringify({ version: STATE_VERSION + 1 }));
    expect(() => new FileStore(file()).read()).toThrow(/newer version/);
  });
});

describe('the tool server', () => {
  it('offers the agent the five tools of the Jira app, with the same inputs', () => {
    expect(AGENT_TOOL_DEFS.map((tool) => tool.name)).toEqual([...MCP_TOOLS]);
    const actions = new Map(entries('action').map((entry) => [entry.key, entry.block]));
    for (const tool of AGENT_TOOL_DEFS) {
      const block = actions.get(tool.name)!;
      const inputs = [...block.matchAll(/^        ([A-Za-z]+):\n((?:          .+\n)+)/gm)].map((m) => ({
        name: m[1]!,
        type: /type: (\w+)/.exec(m[2]!)![1],
        required: /required: true/.test(m[2]!),
      }));
      expect(Object.keys(tool.inputSchema.properties)).toEqual(inputs.map((input) => input.name));
      expect(tool.inputSchema.required).toEqual(inputs.filter((input) => input.required).map((input) => input.name));
      for (const input of inputs) expect(tool.inputSchema.properties[input.name]!.type).toBe(input.type);
    }
  });

  it('agrees on a protocol version, and falls back to its newest for one it does not know', async () => {
    const { app, options } = server();
    const init = (protocolVersion: string) => handleMessage(app, options, { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion } });
    expect(await init('2024-11-05')).toMatchObject({ result: { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'proof-of-done' } } });
    expect(await init('1999-01-01')).toMatchObject({ result: { protocolVersion: PROTOCOL_VERSIONS[0] } });
  });

  it('answers a notification with nothing, and an unknown method with an error', async () => {
    const { app, options } = server();
    expect(await handleMessage(app, options, { jsonrpc: '2.0', method: 'notifications/initialized' })).toBeNull();
    expect(await handleMessage(app, options, { jsonrpc: '2.0', id: 'a', method: 'resources/list' })).toMatchObject({ id: 'a', error: { code: -32601 } });
    expect(await handleMessage(app, options, 'nonsense')).toMatchObject({ error: { code: -32600 } });
  });

  it.each(VERIFIER_TOOLS)('has no %s tool, so an agent cannot reach a verdict', async (name) => {
    await contract();
    const { app, options } = server();
    const answer = await handleMessage(app, options, { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: { issueKey: 'POD-1' } } });
    expect(answer).toMatchObject({ error: { code: -32602 } });
    expect(JSON.stringify(await handleMessage(app, options, { jsonrpc: '2.0', id: 2, method: 'tools/list' }))).not.toContain(name);
  });

  it('turns away a failing test run and stores a clean one for review', async () => {
    const [tests] = await contract();
    const failing = await call('submit-evidence', { criterionId: tests, kind: 'test_run', summary: 'Unit suite on the branch', passed: 41, failed: 2 });
    expect(failing.body).toMatchObject({ ok: true, passedChecks: false, problems: ['2 tests failed, so this run proves nothing yet.'] });
    const clean = await call('submit-evidence', { criterionId: tests, kind: 'test_run', summary: 'Unit suite on the branch', passed: 43, failed: 0, agentName: 'demo-agent' });
    expect(clean.body).toMatchObject({ ok: true, passedChecks: true, gate: { passes: false } });
    expect((await call('get-done-contract', { issueKey: 'POD-1' })).body).toMatchObject({ proof: { proven: 0, total: 2 }, gate: { passes: false } });
  });

  it('lets an agent start a contract only from the criteria a person wrote', async () => {
    await pod(['init']);
    await pod(['new', 'Lock accounts', '-c', 'Five failures lock the account']);
    const started = await call('start-done-contract', { issueKey: 'POD-1' });
    expect((started.body['criteria'] as Array<{ text: string }>).map((c) => c.text)).toEqual(['Five failures lock the account']);
    expect(AGENT_TOOL_DEFS.some((tool) => /criterion|attest/.test(tool.name))).toBe(false);
  });

  it('speaks of the command line, not of Jira', async () => {
    const [tests] = await contract();
    await call('submit-evidence', { criterionId: tests, kind: 'test_run', summary: 'Unit suite on the branch', passed: 43, failed: 0 });
    const texts = [
      JSON.stringify((await call('get-context-pack', { issueKey: 'POD-1' })).body),
      JSON.stringify((await call('get-done-contract', { issueKey: 'POD-1' })).body),
      JSON.stringify((await call('list-unproven-work', { projectKey: 'POD' })).body),
      JSON.stringify(AGENT_TOOL_DEFS),
    ].join('\n');
    expect(texts).not.toMatch(/Jira|panel|Rovo|Proof Verifier|Teamwork/);
    expect(localWording({ rules: ['Keep this.', "What Jira's Teamwork Graph holds."], next: 'Ask a person to add them in the Proof of Done panel.' })).toEqual({
      rules: ['Keep this.'],
      next: 'Ask a person to add them with the proof-of-done command.',
    });
  });

  it('reports a refusal as a tool error the agent can act on', async () => {
    await contract();
    const answer = await call('submit-evidence', { criterionId: 'nope', kind: 'test_run', summary: 'Unit suite on the branch' });
    expect(answer).toMatchObject({ isError: true, body: { ok: false, code: 'not_found' } });
  });

  it('serves line by line over a stream and writes nothing but protocol messages', async () => {
    await contract();
    const { app, options } = server();
    const input = new PassThrough();
    const output = new PassThrough();
    const chunks: string[] = [];
    output.on('data', (chunk: Buffer) => chunks.push(chunk.toString()));
    const log = console.log;
    const error = console.error;
    console.error = () => {};
    try {
      const done = serve(app, options, input, output);
      input.write('{"jsonrpc":"2.0","id":1,"method":"ping"}\n\nnot json\n');
      input.end('{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"get-done-contract","arguments":{"issueKey":"POD-1"}}}\n');
      await done;
    } finally {
      console.log = log;
      console.error = error;
    }
    const messages = chunks.join('').trim().split('\n').map((line) => JSON.parse(line) as { id: unknown; error?: { code: number } });
    expect(messages.map((m) => m.id)).toEqual([1, null, 2]);
    expect(messages[1]!.error!.code).toBe(-32700);
  });
});

describe('the command line', () => {
  it('walks a task from contract to a proven close', async () => {
    const [tests, notes] = await contract();

    expect((await pod(['gate', 'POD-1'])).code).toBe(EXIT.notProven);
    const refused = await pod(['move', 'POD-1', 'done']);
    expect(refused.code).toBe(EXIT.notProven);
    expect(refused.err).toContain('2 of 2 criteria are not proven');
    expect(refused.err).not.toContain('panel');

    await call('submit-evidence', { criterionId: tests, kind: 'test_run', summary: 'Unit suite on the branch', passed: 43, failed: 0 });
    await call('submit-evidence', { criterionId: notes, kind: 'other', summary: 'Release notes list the export', excerpt: 'Added: CSV export of the audit log.' });
    const queue = await json<Array<{ evidence: { id: string } }>>(['review']);
    expect(queue).toHaveLength(2);

    for (const item of queue) expect((await pod(['accept', item.evidence.id])).code).toBe(EXIT.ok);
    expect((await pod(['gate', 'POD-1'])).out).toContain('Gate: PASS');
    expect((await pod(['move', 'POD-1', 'done'])).code).toBe(EXIT.ok);
    expect(readFileSync(join(root, 'tasks', 'POD-1.md'), 'utf8')).toContain('status: done');
    expect((await pod(['meter', 'POD'])).out).toContain('closed with proof 1, closed without proof 0');
  });

  it('refuses a verdict that does not come from a person at a terminal', async () => {
    const [tests] = await contract();
    const submitted = await call('submit-evidence', { criterionId: tests, kind: 'test_run', summary: 'Unit suite on the branch', passed: 43, failed: 0 });
    const id = submitted.body['evidenceId'] as string;
    const refused = await pod(['accept', id], { interactive: false });
    expect(refused).toMatchObject({ code: EXIT.error });
    expect(refused.err).toContain('Only a person may accept evidence');
    expect((await json<Shown>(['show', 'POD-1'])).criteria[0]!.state).toBe('submitted');
    expect((await pod(['accept', id], { interactive: false, env: { POD_ALLOW_NONINTERACTIVE: '1' } })).code).toBe(EXIT.ok);
  });

  it('needs a reason for a rejection, and counts the rejected criterion as open', async () => {
    const [tests] = await contract();
    const id = (await call('submit-evidence', { criterionId: tests, kind: 'test_run', summary: 'Unit suite on the branch', passed: 1, failed: 0 })).body['evidenceId'] as string;
    expect((await pod(['reject', id])).err).toContain('Say why');
    expect((await pod(['reject', id, '--reason', 'One test is not the suite.'])).code).toBe(EXIT.ok);
    expect((await pod(['gate', 'POD-1'])).out).toContain('1 rejected');
  });

  it('counts an attestation from the assignee as waiting, and from someone else as proof', async () => {
    const [, notes] = await contract();
    await pod(['attest', 'POD-1', notes!, 'I read the release notes and they list the export.'], { as: 'dana' });
    expect((await json<Shown>(['show', 'POD-1'])).criteria[1]!.state).toBe('submitted');
    await pod(['attest', 'POD-1', notes!, 'I checked the release notes myself, and the export is listed.'], { as: 'sam' });
    expect((await json<Shown>(['show', 'POD-1'])).criteria[1]!.state).toBe('proven');
  });

  it('finds work that was closed by editing the file', async () => {
    await contract();
    const file = join(root, 'tasks', 'POD-1.md');
    writeFileSync(file, readFileSync(file, 'utf8').replace('status: todo', 'status: done'));
    const gate = await pod(['gate', '--closed']);
    expect(gate.code).toBe(EXIT.notProven);
    expect(gate.out).toContain('NO    POD-1');
    expect((await pod(['gate', '--closed', '--json'])).out).toContain('"pass": false');
  });

  it('lets the team turn the gate off, and a task with no contract pass unless the project requires one', async () => {
    await pod(['init']);
    await pod(['new', 'No criteria here']);
    expect((await pod(['gate', 'POD-1'])).code).toBe(EXIT.ok);
    await pod(['settings', 'POD', '--require-contract', 'on']);
    expect((await pod(['gate', 'POD-1'])).code).toBe(EXIT.notProven);
    expect((await pod(['settings', 'POD', '--gate', 'off'])).out).toContain('gate: off');
    expect((await pod(['gate', 'POD-1'])).code).toBe(EXIT.ok);
    expect((await pod(['settings', 'POD', '--gate', 'warn'], { interactive: false })).code).toBe(EXIT.error);
  });

  it('holds an agent at a stop hook only while the agent can still add evidence', async () => {
    const [tests, notes] = await contract();
    expect((await pod(['gate', '--in-progress', '--hook'])).code).toBe(EXIT.ok);
    await pod(['move', 'POD-1', 'in-progress']);

    const held = await pod(['gate', '--in-progress', '--hook']);
    expect(held.code).toBe(HOOK_BLOCK);
    expect(held.err).toContain('POD-1 needs evidence: All unit tests pass');
    expect(held.err).toContain('POD-1 needs evidence: Release notes are updated');

    await call('submit-evidence', { criterionId: tests, kind: 'test_run', summary: 'Unit suite on the branch', passed: 43, failed: 0 });
    await call('submit-evidence', { criterionId: notes, kind: 'other', summary: 'Release notes list the export', excerpt: 'Added: CSV export.' });
    const waiting = await pod(['gate', '--in-progress', '--hook']);
    expect(waiting).toMatchObject({ code: EXIT.ok, err: '' });
    expect(waiting.out).toContain("POD-1 waits for a person's review. Not done yet.");
    expect((await pod(['gate', '--in-progress'])).code).toBe(EXIT.notProven);
  });

  it('does not hold an agent for a criterion that only a person can prove', async () => {
    await pod(['init']);
    await pod(['new', 'Ship the export']);
    await pod(['criterion', 'POD-1', 'The product owner signed off', '--needs', 'attestation']);
    await pod(['move', 'POD-1', 'in-progress']);
    const answer = await pod(['gate', '--in-progress', '--hook']);
    expect(answer).toMatchObject({ code: EXIT.ok, err: '' });
    expect(answer.out).toContain("POD-1 needs a person's attestation. Not done yet.");
  });

  it('counts a task written in an editor in the meter', async () => {
    await pod(['init']);
    mkdirSync(join(root, 'tasks'), { recursive: true });
    writeFileSync(join(root, 'tasks', 'POD-1.md'), '# Written by hand\n\n## Acceptance criteria\n- It works\n');
    clock = Date.now();
    expect((await pod(['meter', 'POD'])).out).toContain('opened 1,');
  });

  it('reports the version of the package', async () => {
    const pkg = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf8')) as { version: string };
    expect((await pod(['--version'])).out).toBe(pkg.version);
  });

  it('answers a mistake with one line and exit code 2', async () => {
    expect(await pod(['list'])).toMatchObject({ code: EXIT.error, err: expect.stringContaining('proof-of-done init') });
    await pod(['init']);
    expect(await pod(['frobnicate'])).toMatchObject({ code: EXIT.error, err: expect.stringContaining('Unknown command') });
    expect(await pod(['gate'])).toMatchObject({ code: EXIT.error });
    expect(await pod(['gate', 'POD-99'])).toMatchObject({ code: EXIT.error, err: expect.stringContaining('no task POD-99') });
    expect(await pod(['show', 'POD-1', '--bogus'])).toMatchObject({ code: EXIT.error, err: 'Unknown option --bogus.' });
    expect((await pod(['help'])).out).toContain('Usage: proof-of-done');
  });

  it('runs as a program, and survives a reader that stops early', () => {
    const tsx = join(__dirname, '../node_modules/tsx/dist/cli.mjs');
    const cli = join(__dirname, '../src/local/cli.ts');
    const out = execFileSync(process.execPath, [tsx, cli, 'init'], { cwd: dir, encoding: 'utf8' });
    expect(out).toContain('Ready:');
    const status = execFileSync('sh', ['-c', `"${process.execPath}" "${tsx}" "${cli}" help | head -1; echo "exit \${PIPESTATUS:-0}"`], { cwd: dir, encoding: 'utf8' });
    expect(status).toContain('Proof of Done');
    expect(status).not.toContain('EPIPE');
  }, 30_000);
});
