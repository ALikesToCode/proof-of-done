import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MCP_TOOLS, TOOLS, VERIFIER_TOOLS, accountOf, issueOf, projectOf, runTool } from '../src/actions/tools';
import { AgentService } from '../src/services/agent';
import { ContractService } from '../src/services/contracts';
import { ProjectService } from '../src/services/project';
import { doc, h, ul } from './helpers/adf';
import { FakeJira, MemoryStore, issueInfo } from './helpers/fakes';
import { entries, items, repoFile, section } from './helpers/manifest';

const ALICE = { principal: { accountId: 'alice' } };

let store: MemoryStore;
let jira: FakeJira;
let agent: AgentService;

beforeEach(() => {
  store = new MemoryStore();
  jira = new FakeJira();
  agent = new AgentService(new ContractService(store, jira), new ProjectService(store, jira), jira, store);
  jira.add(issueInfo({ id: '1', key: 'MOBL-1', description: doc(h(2, 'Acceptance criteria'), ul('Login works', 'Logout works')) }));
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('who and what a tool call is about', () => {
  it('takes the account from the invocation, never from an input', async () => {
    expect(accountOf({ principal: { accountId: 'alice' } })).toBe('alice');
    expect(accountOf({ accountId: 'bob' })).toBe('bob');
    expect(accountOf({})).toBeNull();
    expect(accountOf(null)).toBeNull();

    const started = await runTool(agent, 'start-done-contract', { issueKey: 'MOBL-1', accountId: 'mallory', agentName: ' codex ' }, ALICE);
    expect(started.ok).toBe(true);
    expect(store.contracts.get('1')?.createdBy).toBe('alice');
    expect(store.events[0]).toMatchObject({ actorAccountId: 'alice', channel: 'agent' });
  });

  it('refuses a call that names no account', async () => {
    const result = await runTool(agent, 'get-done-contract', { issueKey: 'MOBL-1' }, {});
    expect(result).toEqual({
      ok: false,
      code: 'forbidden',
      error: 'This call does not say which Atlassian account it runs as, so Proof of Done cannot tell what it may see.',
    });
  });

  it('finds the work item key in what a model wrote, or on the screen', () => {
    expect(issueOf({ issueKey: 'MOBL-1' })).toBe('MOBL-1');
    expect(issueOf({ issueKey: ' https://example.atlassian.net/browse/POD-12 ' })).toBe('POD-12');
    expect(issueOf({ issueKey: 'the ticket POD-7 please' })).toBe('POD-7');
    expect(issueOf({ issueKey: '10010' })).toBe('10010');
    expect(issueOf({ issueKey: '', context: { jira: { issueKey: 'POD-3', issueId: 66400 } } })).toBe('POD-3');
    expect(issueOf({ context: { jira: { issueId: 66400 } } })).toBe('66400');
    expect(issueOf({ issueKey: 'this one' })).toBe('this one');
    expect(issueOf({})).toBe('');
  });

  it('finds the project key the same way', () => {
    expect(projectOf({ projectKey: 'POD' })).toBe('POD');
    expect(projectOf({ projectKey: 'POD-12' })).toBe('POD');
    expect(projectOf({ context: { jira: { projectKey: 'MOBL' } } })).toBe('MOBL');
    expect(projectOf({})).toBe('');
  });
});

describe('running a tool', () => {
  it('answers with ok and the data, or with a code and a message an agent can act on', async () => {
    const contract = await runTool(agent, 'get-done-contract', { issueKey: 'MOBL-1' }, ALICE);
    expect(contract).toMatchObject({ ok: true, hasContract: false, workItem: { key: 'MOBL-1' } });

    const missing = await runTool(agent, 'get-done-contract', { issueKey: 'MOBL-99' }, ALICE);
    expect(missing).toEqual({ ok: false, code: 'not_found', error: 'Work item MOBL-99 does not exist, or you do not have access to it.' });

    const invalid = await runTool(agent, 'get-done-contract', {}, ALICE);
    expect(invalid).toEqual({ ok: false, code: 'invalid', error: 'Give the work item key, for example ABC-123.' });
  });

  it('uses the work item on the screen when the model passes none', async () => {
    const result = await runTool(agent, 'get-context-pack', { context: { cloudId: 'c', moduleKey: 'get-context-pack', jira: { issueKey: 'MOBL-1' } } }, ALICE);
    expect(result).toMatchObject({ ok: true, workItem: { key: 'MOBL-1' } });
  });

  it('walks an agent from the contract to evidence, and a verifier to the verdict', async () => {
    const started = await runTool(agent, 'start-done-contract', { issueKey: 'MOBL-1' }, ALICE);
    const criteria = (started as unknown as { criteria: Array<{ id: string }> }).criteria;
    const submitted = await runTool(
      agent,
      'submit-evidence',
      { criterionId: criteria[0]!.id, kind: 'test_run', summary: 'The login tests pass.', passed: 9, failed: 0, agentName: 'claude-code' },
      ALICE,
    );
    expect(submitted).toMatchObject({ ok: true, passedChecks: true });
    expect(store.evidence[0]).toMatchObject({ channel: 'agent', agentName: 'claude-code', actorAccountId: 'alice' });

    const queue = await runTool(agent, 'list-evidence-to-review', { issueKey: 'MOBL-1' }, ALICE);
    const waiting = (queue as unknown as { waiting: Array<{ evidenceId: string }> }).waiting;
    expect(waiting).toHaveLength(1);
    const verdict = await runTool(
      agent,
      'record-verdict',
      { issueKey: 'MOBL-1', evidenceId: waiting[0]!.evidenceId, decision: 'accepted', reason: 'Nine login tests passed and none failed.' },
      ALICE,
    );
    expect(verdict).toMatchObject({ ok: true, decision: 'accepted' });
    expect(store.verdicts[0]).toMatchObject({ channel: 'verifier', independent: true });

    const work = await runTool(agent, 'list-unproven-work', { projectKey: 'MOBL-1' }, ALICE);
    expect(work).toMatchObject({ ok: true, project: { key: 'MOBL' }, contracts: { total: 1, proven: 0 } });
  });

  it('tells the person how to grant access when Jira will not act as them', async () => {
    jira.getIssue = async () => {
      throw Object.assign(new Error('Authentication Required'), { name: 'NEEDS_AUTHENTICATION_ERR', status: 401 });
    };
    const result = await runTool(agent, 'get-done-contract', { issueKey: 'MOBL-1' }, ALICE);
    expect(result).toEqual({
      ok: false,
      code: 'needs_access',
      error:
        'Proof of Done cannot act as you yet. Open the Proof of Done panel on any work item in Jira, choose Allow access, and then call this tool again.',
    });
  });

  it('keeps the details of an unexpected failure out of the answer and the payload out of the log', async () => {
    jira.getIssue = async () => {
      throw new Error('socket hang up at 10.0.0.7');
    };
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const result = await runTool(agent, 'get-done-contract', { issueKey: 'MOBL-1', summary: 'secret plan' }, ALICE);
    expect(result).toEqual({ ok: false, code: 'internal', error: 'Proof of Done could not finish this call. Try it again.' });
    expect(error).toHaveBeenCalledWith('Proof of Done: tool get-done-contract failed. socket hang up at 10.0.0.7');
    expect(JSON.stringify(error.mock.calls)).not.toContain('secret plan');
  });
});

describe('the manifest', () => {
  const index = repoFile('src/index.ts');
  const actions = entries('action').map(({ key, block }) => ({
    key,
    fn: /^      function: (.+)$/m.exec(block)?.[1] ?? '',
    description: (/^      description: >\n((?:        .*\n)+)/m.exec(block)?.[1] ?? '')
      .split('\n')
      .map((line) => line.trim())
      .join(' ')
      .trim(),
    inputs: [...block.matchAll(/^        ([A-Za-z]+):$/gm)].map((m) => m[1]),
  }));
  const functions = new Map([...section('function').matchAll(/    - key: (.+)\n      handler: index\.(.+)\n/g)].map((m) => [m[1]!, m[2]!]));

  it('declares one action per tool, each backed by an exported function', () => {
    expect(actions.map((a) => a.key).sort()).toEqual([...TOOLS].sort());
    for (const action of actions) {
      const handler = functions.get(action.fn);
      expect(handler, `function of ${action.key}`).toBeTruthy();
      expect(index, `export of ${handler}`).toMatch(new RegExp(`\\b${handler}\\b`));
    }
  });

  it('offers outside agents every tool except the two that judge evidence', () => {
    const servers = entries('rovo:mcp');
    expect(servers).toHaveLength(1);
    const offered = items(servers[0]!.block, 'tools');
    expect(offered).toEqual([...MCP_TOOLS]);
    expect(offered).not.toContain('record-verdict');
    expect(offered).not.toContain('list-evidence-to-review');
    expect([...MCP_TOOLS, ...VERIFIER_TOOLS].sort()).toEqual([...TOOLS].sort());
  });

  it('stays inside the limits Forge sets for actions', () => {
    for (const action of actions) {
      expect(action.description.length, `description of ${action.key}`).toBeGreaterThan(40);
      expect(action.description.length, `description of ${action.key}`).toBeLessThanOrEqual(255);
      expect(action.inputs.length, `inputs of ${action.key}`).toBeLessThanOrEqual(10);
      expect(action.fn.length, `function key of ${action.key}`).toBeLessThanOrEqual(23);
    }
    expect(actions.find((a) => a.key === 'submit-evidence')?.inputs).toEqual([
      'criterionId',
      'kind',
      'summary',
      'url',
      'passed',
      'failed',
      'status',
      'commit',
      'excerpt',
      'agentName',
    ]);
  });
});
