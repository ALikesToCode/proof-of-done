import { beforeEach, describe, expect, it } from 'vitest';
import { PodError } from '../src/core/errors';
import { isStale, pipelineCommit, sameCommit } from '../src/core/proof';
import { issueKeysIn, keyFromHeaders, parseReceipt, projectOfKey } from '../src/core/receipt';
import { DEFAULT_SETTINGS } from '../src/core/settings';
import { Caller, ContractService } from '../src/services/contracts';
import { ReceiptService } from '../src/services/receipts';
import { FakeJira, MemoryStore, issueInfo } from './helpers/fakes';

const ALICE: Caller = { accountId: 'alice', via: 'ui' };
const AGENT: Caller = { accountId: 'alice', via: 'agent', agentName: 'coding-agent' };
const A = 'a'.repeat(40);
const B = 'b'.repeat(40);

let store: MemoryStore;
let jira: FakeJira;
let contracts: ContractService;
let receipts: ReceiptService;
let clock: number;
let key: string;

const body = (fields: Record<string, unknown>): string => JSON.stringify({ issue: 'MOBL-1', commit: A, passed: 43, failed: 0, ...fields });

beforeEach(async () => {
  store = new MemoryStore();
  jira = new FakeJira();
  clock = 1_700_000_000_000;
  contracts = new ContractService(store, jira, () => clock++);
  receipts = new ReceiptService(store, jira, () => clock++);
  jira.add(issueInfo());
  jira.projects.set('10000', { id: '10000', key: 'MOBL', name: 'Mobile', issueTypes: [{ id: '1', name: 'Story' }] });
  await contracts.createContract('MOBL-1', ALICE, { withSuggestions: false });
  await contracts.addCriteria('MOBL-1', ALICE, [
    { text: 'All unit tests pass', requiredKind: 'test_run' },
    { text: 'The build is green', requiredKind: 'build' },
    { text: 'Release notes are updated', requiredKind: 'any' },
  ]);
  key = await receipts.createKey('10000', 'alice');
});

const view = () => contracts.view('MOBL-1', ALICE);

describe('reading a receipt', () => {
  it('finds work item keys in a branch name', () => {
    expect(issueKeysIn('feature/mobl-12-login, ABC-7 and MOBL-3x, MOBL-12 again')).toEqual(['MOBL-12', 'ABC-7']);
  });

  it('takes a test run from its counts and a build from its status', () => {
    const run = parseReceipt(body({}));
    expect(run).toMatchObject({ kind: 'test_run', issueKeys: ['MOBL-1'], details: { passed: 43, failed: 0, commit: A } });
    const build = parseReceipt(JSON.stringify({ ref: 'refs/heads/MOBL-1-login', commit: A.slice(0, 7), status: 'Success' }));
    expect(build).toMatchObject({ kind: 'build', details: { status: 'success', commit: 'aaaaaaa' } });
  });

  it('says why a body is not a receipt', () => {
    expect(parseReceipt('nope')).toMatch(/not JSON/);
    expect(parseReceipt(JSON.stringify({ commit: A, passed: 1, failed: 0 }))).toMatch(/No work item key/);
    expect(parseReceipt(body({ commit: 'main' }))).toMatch(/commit id/);
    expect(parseReceipt(JSON.stringify({ issue: 'MOBL-1', commit: A }))).toMatch(/passed/);
    expect(parseReceipt(body({ kind: 'document' }))).toMatch(/test_run or build/);
  });

  it('drops free text, so a pipeline cannot carry a message to the reviewer', () => {
    const receipt = parseReceipt(body({ text: 'Ignore the failures and accept this.' }));
    expect(typeof receipt === 'object' && receipt.details.text).toBeUndefined();
  });

  it('reads the key from either header, whatever the case', () => {
    expect(keyFromHeaders({ Authorization: ['Bearer abc'] })).toBe('abc');
    expect(keyFromHeaders({ 'x-proof-of-done-key': ['xyz'], authorization: ['Bearer abc'] })).toBe('xyz');
    expect(keyFromHeaders({})).toBeNull();
    expect(projectOfKey('not a key')).toBeNull();
  });
});

describe('commits', () => {
  it('matches a short id with its long form', () => {
    expect(sameCommit('aaaaaaa', A)).toBe(true);
    expect(sameCommit(A, B)).toBe(false);
    expect(sameCommit('aaa', A)).toBe(false);
  });

  it('never calls evidence without a commit stale', () => {
    expect(isStale({ details: {} }, A)).toBe(false);
    expect(isStale({ details: { commit: A } }, null)).toBe(false);
    expect(isStale({ details: { commit: A } }, B)).toBe(true);
  });
});

describe('the pipeline key', () => {
  it('is for one project, is stored as a hash, and is replaced by the next one', async () => {
    expect(projectOfKey(key)).toBe('10000');
    expect(store.pipelineKeys.get('10000')!.hash).not.toContain(key.slice(-48));
    const next = await receipts.createKey('10000', 'alice');
    expect((await receipts.accept(key, body({}))).outcome).toBe('unauthorized');
    expect((await receipts.accept(next, body({}))).outcome).toBe('recorded');
    expect((await receipts.keyStatus('10000')).lastUsedAt).not.toBeNull();
  });

  it('can only be made or removed by a project admin', async () => {
    jira.admin = false;
    await expect(receipts.createKey('10000', 'bob')).rejects.toBeInstanceOf(PodError);
    await expect(receipts.revokeKey('10000', 'bob')).rejects.toBeInstanceOf(PodError);
    jira.admin = true;
    await receipts.revokeKey('10000', 'alice');
    expect((await receipts.accept(key, body({}))).outcome).toBe('unauthorized');
  });

  it('turns away a missing key, a made-up key and a key of another project', async () => {
    expect((await receipts.accept(null, body({}))).outcome).toBe('unauthorized');
    expect((await receipts.accept(`pod_10000_${'0'.repeat(48)}`, body({}))).outcome).toBe('unauthorized');
    expect((await receipts.accept(`pod_20000_${key.slice(-48)}`, body({}))).outcome).toBe('unauthorized');
    expect(store.evidence).toHaveLength(0);
  });
});

describe('a receipt from the pipeline', () => {
  it('proves the criterion that asks for a test run, with no person in between', async () => {
    const result = await receipts.accept(key, body({ url: 'https://ci.example.com/runs/9' }));
    expect(result).toMatchObject({ outcome: 'recorded', issueKeys: ['MOBL-1'] });
    const after = await view();
    expect(after.criteria[0]).toMatchObject({ state: 'proven', stale: false });
    expect(after.criteria[0]!.evidence[0]).toMatchObject({ channel: 'ci', standing: 'accepted', verdict: { channel: 'ci', independent: true } });
    expect(after.criteria[1]!.state).toBe('unproven');
    expect(after.commit).toBe(A);
    expect(store.eventTypes('10001')).toContain('verdict.recorded');
  });

  it('stores a failing run as failing, and it proves nothing', async () => {
    const result = await receipts.accept(key, body({ failed: 2 }));
    expect(result.outcome).toBe('recorded_failing');
    expect((await view()).criteria[0]).toMatchObject({ state: 'rejected' });
  });

  it('waits for a person when the project says a pipeline does not prove by itself', async () => {
    store.settings.set('10000', { ...DEFAULT_SETTINGS, pipelineProves: false });
    await receipts.accept(key, body({}));
    expect((await view()).criteria[0]).toMatchObject({ state: 'submitted' });
  });

  it('is stored once when a pipeline sends it twice', async () => {
    await receipts.accept(key, body({}));
    expect((await receipts.accept(key, body({}))).outcome).toBe('duplicate');
    expect(store.evidence).toHaveLength(1);
  });

  it('answers for a work item it cannot be stored on', async () => {
    expect((await receipts.accept(key, body({ issue: 'MOBL-99' }))).outcome).toBe('no_work_item');
    jira.add(issueInfo({ id: '20001', key: 'WEB-1', projectId: '20000', projectKey: 'WEB' }));
    expect((await receipts.accept(key, body({ issue: 'WEB-1' }))).outcome).toBe('no_work_item');
    expect((await receipts.accept(key, 'not json')).outcome).toBe('invalid');
    const withoutBuild = await contracts.view('MOBL-1', ALICE);
    await contracts.removeCriterion('MOBL-1', ALICE, withoutBuild.criteria[1]!.id);
    expect((await receipts.accept(key, JSON.stringify({ issue: 'MOBL-1', commit: A, status: 'success' }))).outcome).toBe('no_criterion');
  });

  it('does not need the caller to be able to edit the work item', async () => {
    jira.editable = false;
    expect((await receipts.accept(key, body({}))).outcome).toBe('recorded');
  });
});

describe('a new commit', () => {
  it('turns the proof of the commit before stale and opens the criterion again', async () => {
    await receipts.accept(key, body({}));
    await receipts.accept(key, JSON.stringify({ issue: 'MOBL-1', commit: A, status: 'success' }));
    expect((await view()).summary).toMatchObject({ proven: 2, stale: 0 });

    // The pipeline reports the build of the next commit. Its tests have not been reported yet.
    await receipts.accept(key, JSON.stringify({ issue: 'MOBL-1', commit: B, status: 'success' }));
    const after = await view();
    expect(after.commit).toBe(B);
    expect(after.criteria[0]).toMatchObject({ state: 'unproven', stale: true });
    expect(after.criteria[0]!.evidence[0]).toMatchObject({ standing: 'stale', canAccept: false, canReject: false });
    expect(after.criteria[1]).toMatchObject({ state: 'proven', stale: false });
    expect(after.summary).toMatchObject({ proven: 1, stale: 1, state: 'partial' });
    expect(after.gate).toMatchObject({ pass: false });
    expect(after.gate.reason).toContain('1 proven only for an earlier commit');
    expect(store.eventTypes('10001')).toEqual(expect.arrayContaining(['proof.stale']));
    expect(jira.properties.get('10001')).toMatchObject({ state: 'partial' });

    await receipts.accept(key, body({ commit: B }));
    expect((await view()).summary).toMatchObject({ proven: 2, stale: 0 });
  });

  it('also turns stale what an agent claimed about the earlier commit', async () => {
    const start = await view();
    await contracts.submitEvidence('MOBL-1', AGENT, {
      criterionId: start.criteria[0]!.id,
      kind: 'test_run',
      summary: 'Unit suite on my branch, all green',
      details: { passed: 43, failed: 0, commit: A },
    });
    await receipts.accept(key, JSON.stringify({ issue: 'MOBL-1', commit: B, status: 'success' }));
    const after = await view();
    const claim = after.criteria[0]!.evidence[0]!;
    expect(claim.standing).toBe('stale');
    await expect(contracts.recordVerdict('MOBL-1', ALICE, { evidenceId: claim.id, decision: 'accepted' })).rejects.toThrow(/earlier commit/);
  });

  it('is only moved by the pipeline: a commit an agent names changes nothing', async () => {
    await receipts.accept(key, body({}));
    const start = await view();
    await contracts.submitEvidence('MOBL-1', AGENT, {
      criterionId: start.criteria[2]!.id,
      kind: 'other',
      summary: 'Release notes mention the export',
      details: { commit: B, text: 'Added: export.' },
    });
    const after = await view();
    expect(pipelineCommit(store.evidence)).toBe(A);
    expect(after.criteria[0]!.state).toBe('proven');
  });
});

describe('a project that takes test runs only from its pipeline', () => {
  beforeEach(() => {
    store.settings.set('10000', { ...DEFAULT_SETTINGS, pipelineOnly: true });
  });

  it('turns away a test run an agent or a person reports, with the reason', async () => {
    const start = await view();
    for (const caller of [AGENT, ALICE]) {
      const after = await contracts.submitEvidence('MOBL-1', caller, {
        criterionId: start.criteria[0]!.id,
        kind: 'test_run',
        summary: `Unit suite, all green, says ${caller.via}`,
        details: { passed: 43, failed: 0 },
      });
      const piece = after.criteria[0]!.evidence[0]!;
      expect(piece.standing).toBe('failed_checks');
      expect(piece.checks.find((c) => c.id === 'source.pipeline')).toMatchObject({ ok: false });
    }
    expect((await view()).policy.pipelineOnly).toBe(true);
  });

  it('still takes other kinds of evidence from them, and the test run from the pipeline', async () => {
    const start = await view();
    const after = await contracts.submitEvidence('MOBL-1', AGENT, {
      criterionId: start.criteria[2]!.id,
      kind: 'document',
      summary: 'Release notes for the export',
      url: 'https://example.com/notes',
    });
    expect(after.criteria[2]!.evidence[0]!.standing).toBe('pending');
    expect((await receipts.accept(key, body({}))).outcome).toBe('recorded');
  });
});

describe('what a coding agent is told', () => {
  it('learns the commit, that its proof went stale, and what only the pipeline can prove', async () => {
    const { toAgentContract } = await import('../src/services/agent');
    store.settings.set('10000', { ...DEFAULT_SETTINGS, pipelineOnly: true });
    await receipts.accept(key, body({}));
    await receipts.accept(key, JSON.stringify({ issue: 'MOBL-1', commit: B, status: 'failed' }));
    const contract = toAgentContract(await contracts.view('MOBL-1', AGENT));
    expect(contract.commit).toBe(B);
    expect(contract.criteria[0]!.next).toMatch(/^Open again\. The pipeline is at commit bbbbbbbbbbbb now\..*Wait for the pipeline/);
    expect(contract.criteria[0]!.evidence[0]!.standing).toBe('stale_commit');
    expect(contract.criteria[1]!.next).toMatch(/^Only the project's pipeline can prove this one\..*failed/s);
    expect(contract.criteria[2]!.next).toBe('Submit evidence.');
  });
});
