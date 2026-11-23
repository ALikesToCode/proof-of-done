import { beforeEach, describe, expect, it } from 'vitest';
import { PodError } from '../src/core/errors';
import { DEFAULT_SETTINGS } from '../src/core/settings';
import { Caller, ContractService } from '../src/services/contracts';
import { ContractView } from '../src/services/view';
import { doc, h, p, ul } from './helpers/adf';
import { FakeJira, MemoryStore, issueInfo } from './helpers/fakes';

const ALICE: Caller = { accountId: 'alice', via: 'ui' };
const BOB: Caller = { accountId: 'bob', via: 'ui' };
const ALICES_AGENT: Caller = { accountId: 'alice', via: 'agent', agentName: 'claude-code' };
const VERIFIER: Caller = { accountId: 'alice', via: 'verifier' };

const DESCRIPTION = doc(
  p('As a user I want to log in.'),
  h(2, 'Acceptance criteria'),
  ul('Login works with email and password', 'All unit tests pass', 'Release notes are updated'),
);

const TEST_RUN = { kind: 'test_run', summary: 'Full unit suite on the login branch', url: 'https://ci.example.com/runs/42', details: { passed: 120, failed: 0 } };

let store: MemoryStore;
let jira: FakeJira;
let service: ContractService;
let clock: number;

beforeEach(() => {
  store = new MemoryStore();
  jira = new FakeJira();
  clock = 1_700_000_000_000;
  service = new ContractService(store, jira, () => clock++);
  jira.add(issueInfo({ description: DESCRIPTION }));
});

async function expectError(promise: Promise<unknown>, code: PodError['code']): Promise<PodError> {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(PodError);
  expect((error as PodError).code).toBe(code);
  return error as PodError;
}

const criterionId = (view: ContractView, index = 0): string => view.criteria[index]!.id;
const firstEvidence = (view: ContractView, index = 0) => view.criteria[index]!.evidence[0]!;

async function contractWithEvidence(caller: Caller = ALICE): Promise<ContractView> {
  const created = await service.createContract('MOBL-1', ALICE, { withSuggestions: true });
  return service.submitEvidence('MOBL-1', caller, { criterionId: criterionId(created), ...TEST_RUN });
}

describe('viewing', () => {
  it('offers the criteria found in the description when there is no contract', async () => {
    const view = await service.view('MOBL-1', ALICE);
    expect(view.exists).toBe(false);
    expect(view.summary.state).toBe('none');
    expect(view.gate.pass).toBe(true);
    expect(view.suggestions.map((s) => s.text)).toEqual([
      'Login works with email and password',
      'All unit tests pass',
      'Release notes are updated',
    ]);
    expect(view.suggestions.every((s) => s.requiredKind === 'any' && s.source === 'description')).toBe(true);
    expect(view.suggestions[0]!.sourceRef).toBe('Acceptance criteria');
  });

  it('accepts a work item id as well as a key', async () => {
    expect((await service.view('10001', ALICE)).issue.key).toBe('MOBL-1');
  });

  it('reports a work item the caller cannot see as not found', async () => {
    await expectError(service.view('MOBL-999', ALICE), 'not_found');
  });

  it('rejects something that is not a work item key', async () => {
    await expectError(service.view('MOBL-1/../../admin', ALICE), 'invalid');
  });

  it('shows a contract read-only to someone who cannot edit the work item', async () => {
    await contractWithEvidence(ALICES_AGENT);
    jira.editable = false;
    const view = await service.view('MOBL-1', BOB);
    expect(view.canEdit).toBe(false);
    expect(firstEvidence(view).canAccept).toBe(false);
    expect(firstEvidence(view).canReject).toBe(false);
  });
});

describe('creating a contract', () => {
  it('fills the contract from the description and the project rules', async () => {
    await store.saveSettings('10000', {
      ...DEFAULT_SETTINGS,
      rules: [
        { id: 'r1', text: 'Pull request is merged', requiredKind: 'pull_request', issueTypes: [] },
        { id: 'r2', text: 'Root cause is written down', requiredKind: 'document', issueTypes: ['Bug'] },
      ],
    });
    const view = await service.createContract('MOBL-1', ALICE, { withSuggestions: true });
    expect(view.exists).toBe(true);
    expect(view.criteria.map((c) => [c.text, c.source, c.requiredKind])).toEqual([
      ['Login works with email and password', 'description', 'any'],
      ['All unit tests pass', 'description', 'any'],
      ['Release notes are updated', 'description', 'any'],
      ['Pull request is merged', 'project_rule', 'pull_request'],
    ]);
    expect(view.summary).toMatchObject({ total: 4, proven: 0, unproven: 4, state: 'unproven' });
    expect(view.gate.pass).toBe(false);
    expect(view.suggestions).toEqual([]);
    expect(store.summaries.get('10001')).toMatchObject({ total: 4, state: 'unproven' });
    expect(jira.properties.get('10001')).toMatchObject({ state: 'unproven', proven: 0, total: 4, open: 4 });
    expect(store.eventTypes('10001')).toEqual(['contract.created']);
  });

  it('can start empty', async () => {
    const view = await service.createContract('MOBL-1', ALICE, { withSuggestions: false });
    expect(view.exists).toBe(true);
    expect(view.criteria).toEqual([]);
    expect(view.summary.state).toBe('none');
    expect(view.suggestions).toHaveLength(3);
  });

  it('refuses a second contract for the same work item', async () => {
    await service.createContract('MOBL-1', ALICE, { withSuggestions: true });
    await expectError(service.createContract('MOBL-1', BOB, { withSuggestions: true }), 'conflict');
    expect(store.criteria).toHaveLength(3);
  });

  it('lets an agent start a contract from the ticket, but not an empty one', async () => {
    const view = await service.createContract('MOBL-1', ALICES_AGENT, { withSuggestions: true });
    expect(view.criteria).toHaveLength(3);
    jira.add(issueInfo({ id: '10002', key: 'MOBL-2', description: doc(p('Fix the thing.')) }));
    await expectError(service.createContract('MOBL-2', ALICES_AGENT, { withSuggestions: true }), 'invalid');
    await expectError(service.createContract('MOBL-2', ALICES_AGENT, { withSuggestions: false }), 'invalid');
  });

  it('needs permission to edit the work item', async () => {
    jira.editable = false;
    await expectError(service.createContract('MOBL-1', ALICE, { withSuggestions: true }), 'forbidden');
    expect(store.contracts.size).toBe(0);
  });

  it('keeps working when the proof property cannot be written', async () => {
    jira.failPropertyWrites = true;
    const view = await service.createContract('MOBL-1', ALICE, { withSuggestions: true });
    expect(view.criteria).toHaveLength(3);
  });
});

describe('editing criteria', () => {
  it('adds a criterion and starts the contract if there is none', async () => {
    const view = await service.addCriteria('MOBL-1', ALICE, [{ text: '  Works   offline ', requiredKind: 'test_run' }]);
    expect(view.exists).toBe(true);
    expect(view.criteria.map((c) => [c.text, c.source, c.requiredKind])).toEqual([['Works offline', 'manual', 'test_run']]);
    expect(store.eventTypes('10001')).toEqual(['contract.created', 'criterion.added']);
  });

  it('refuses duplicates, short text and unknown kinds', async () => {
    await service.createContract('MOBL-1', ALICE, { withSuggestions: true });
    await expectError(service.addCriteria('MOBL-1', ALICE, [{ text: 'all unit tests PASS' }]), 'conflict');
    await expectError(service.addCriteria('MOBL-1', ALICE, [{ text: 'ok' }]), 'invalid');
    await expectError(service.addCriteria('MOBL-1', ALICE, [{ text: 'Works offline', requiredKind: 'vibes' }]), 'invalid');
    await expectError(service.addCriteria('MOBL-1', ALICE, []), 'invalid');
  });

  it('does not let an agent or the verifier change the contract', async () => {
    await service.createContract('MOBL-1', ALICE, { withSuggestions: true });
    await expectError(service.addCriteria('MOBL-1', ALICES_AGENT, [{ text: 'Anything goes' }]), 'forbidden');
    const view = await service.view('MOBL-1', ALICE);
    await expectError(service.removeCriterion('MOBL-1', ALICES_AGENT, criterionId(view)), 'forbidden');
    await expectError(service.replaceCriterion('MOBL-1', VERIFIER, criterionId(view), { text: 'Easier' }), 'forbidden');
  });

  it('adds criteria that appeared in the description after the contract was made', async () => {
    await service.createContract('MOBL-1', ALICE, { withSuggestions: true });
    jira.add(
      issueInfo({
        description: doc(h(2, 'Acceptance criteria'), ul('Login works with email and password', 'Works with a password manager')),
      }),
    );
    expect((await service.view('MOBL-1', ALICE)).suggestions.map((s) => s.text)).toEqual(['Works with a password manager']);
    const view = await service.addSuggested('MOBL-1', ALICE);
    expect(view.criteria.map((c) => c.text)).toContain('Works with a password manager');
    expect(view.criteria).toHaveLength(4);
    await expectError(service.addSuggested('MOBL-1', ALICE), 'invalid');
  });

  it('does not offer a criterion again after a person removed it', async () => {
    const created = await service.createContract('MOBL-1', ALICE, { withSuggestions: true });
    const view = await service.removeCriterion('MOBL-1', ALICE, criterionId(created, 1));
    expect(view.criteria.map((c) => c.text)).toEqual(['Login works with email and password', 'Release notes are updated']);
    expect(view.suggestions).toEqual([]);
    expect(view.summary.total).toBe(2);
  });

  it('starts the proof of a criterion over when its wording changes', async () => {
    const withEvidence = await contractWithEvidence(ALICES_AGENT);
    await service.recordVerdict('MOBL-1', ALICE, { evidenceId: firstEvidence(withEvidence).id, decision: 'accepted' });
    const view = await service.replaceCriterion('MOBL-1', ALICE, criterionId(withEvidence), {
      text: 'Login works with email, password and passkey',
    });
    expect(view.criteria[0]).toMatchObject({ text: 'Login works with email, password and passkey', state: 'unproven', source: 'manual' });
    expect(view.criteria[0]!.evidence).toEqual([]);
    expect(view.criteria).toHaveLength(3);
    expect(view.summary.proven).toBe(0);
    // The evidence given for the old wording can no longer be judged.
    await expectError(service.recordVerdict('MOBL-1', BOB, { evidenceId: firstEvidence(withEvidence).id, decision: 'rejected', reason: 'Stale' }), 'invalid');
  });

  it('keeps the origin of a criterion when only the required evidence changes', async () => {
    const created = await service.createContract('MOBL-1', ALICE, { withSuggestions: true });
    const view = await service.replaceCriterion('MOBL-1', ALICE, criterionId(created, 1), {
      text: 'All unit tests pass',
      requiredKind: 'test_run',
    });
    expect(view.criteria[1]).toMatchObject({ text: 'All unit tests pass', requiredKind: 'test_run', source: 'description' });
    expect(view.criteria[1]!.id).not.toBe(criterionId(created, 1));
  });

  it('caps the number of criteria', async () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ text: `Criterion number ${i + 1}` }));
    await service.addCriteria('MOBL-1', ALICE, many);
    await expectError(service.addCriteria('MOBL-1', ALICE, [{ text: 'One too many' }]), 'invalid');
  });
});

describe('submitting evidence', () => {
  it('queues evidence that passes its checks for review', async () => {
    const view = await contractWithEvidence();
    expect(view.criteria[0]!.state).toBe('submitted');
    expect(firstEvidence(view)).toMatchObject({ standing: 'pending', channel: 'ui', actorAccountId: 'alice', agentName: null });
    expect(view.summary).toMatchObject({ submitted: 1, unproven: 2, state: 'unproven' });
    expect(jira.properties.get('10001')).toMatchObject({ state: 'unproven', proven: 0 });
  });

  it('stores evidence that fails a check, but it proves nothing', async () => {
    const created = await service.createContract('MOBL-1', ALICE, { withSuggestions: true });
    const view = await service.submitEvidence('MOBL-1', ALICES_AGENT, {
      criterionId: criterionId(created),
      kind: 'test_run',
      summary: 'Unit suite after the login change',
      details: { passed: '118', failed: '2' },
    });
    const evidence = firstEvidence(view);
    expect(evidence.standing).toBe('failed_checks');
    expect(evidence.agentName).toBe('claude-code');
    expect(evidence.checks.find((c) => !c.ok)?.id).toBe('test_run.failed');
    expect(view.criteria[0]!.state).toBe('rejected');
    expect(evidence.canAccept).toBe(false);
    await expectError(service.recordVerdict('MOBL-1', BOB, { evidenceId: evidence.id, decision: 'accepted' }), 'invalid');
  });

  it('holds evidence to the kind a criterion requires', async () => {
    const created = await service.addCriteria('MOBL-1', ALICE, [{ text: 'All unit tests pass', requiredKind: 'test_run' }]);
    const view = await service.submitEvidence('MOBL-1', ALICES_AGENT, {
      criterionId: criterionId(created),
      kind: 'pull_request',
      summary: 'The pull request with the change',
      url: 'https://github.com/acme/app/pull/7',
    });
    expect(firstEvidence(view).standing).toBe('failed_checks');
    expect(firstEvidence(view).checks.find((c) => !c.ok)?.id).toBe('kind.match');
  });

  it('refuses the same evidence twice, unknown criteria and unknown kinds', async () => {
    const view = await contractWithEvidence();
    const id = criterionId(view);
    await expectError(service.submitEvidence('MOBL-1', ALICE, { criterionId: id, ...TEST_RUN }), 'conflict');
    await expectError(service.submitEvidence('MOBL-1', ALICE, { criterionId: 'nope', ...TEST_RUN }), 'not_found');
    await expectError(service.submitEvidence('MOBL-1', ALICE, { criterionId: id, kind: 'screenshot', summary: 'A picture of it working' }), 'invalid');
    await expectError(service.submitEvidence('MOBL-1', ALICE, { criterionId: id, kind: 'other', summary: 'x'.repeat(1001) }), 'invalid');
    expect(store.evidence).toHaveLength(1);
  });

  it('needs a contract', async () => {
    await expectError(service.submitEvidence('MOBL-1', ALICE, { criterionId: 'any', ...TEST_RUN }), 'invalid');
  });

  it('notes a link that is reused across criteria without failing it', async () => {
    const first = await contractWithEvidence();
    const view = await service.submitEvidence('MOBL-1', ALICE, { criterionId: criterionId(first, 1), ...TEST_RUN });
    const evidence = firstEvidence(view, 1);
    expect(evidence.standing).toBe('pending');
    expect(evidence.checks.some((c) => c.id === 'url.reused')).toBe(true);
  });

  it('says which evidence it recorded', async () => {
    const created = await service.createContract('MOBL-1', ALICE, { withSuggestions: true });
    const first = await service.addEvidence('MOBL-1', ALICES_AGENT, { criterionId: criterionId(created), ...TEST_RUN });
    const second = await service.addEvidence('MOBL-1', ALICES_AGENT, {
      criterionId: criterionId(created),
      kind: 'other',
      summary: 'The login screen accepts a known account',
      details: { text: 'Signed in as the test account and reached the dashboard.' },
    });
    expect(second.evidenceId).not.toBe(first.evidenceId);
    expect(second.view.criteria[0]!.evidence.map((e) => e.id)).toEqual([second.evidenceId, first.evidenceId]);
  });
});

describe('verdicts', () => {
  it('does not let a person accept evidence they typed in themselves', async () => {
    const view = await contractWithEvidence(ALICE);
    expect(firstEvidence(view)).toMatchObject({ canAccept: false, canReject: true });
    expect(firstEvidence(view).acceptBlocked).toMatch(/someone else/);
    await expectError(service.recordVerdict('MOBL-1', ALICE, { evidenceId: firstEvidence(view).id, decision: 'accepted' }), 'forbidden');
    expect(store.verdicts).toHaveLength(0);
  });

  it('proves a criterion when someone else accepts the evidence', async () => {
    const pending = await contractWithEvidence(ALICE);
    const forBob = await service.view('MOBL-1', BOB);
    expect(firstEvidence(forBob).canAccept).toBe(true);
    const view = await service.recordVerdict('MOBL-1', BOB, { evidenceId: firstEvidence(pending).id, decision: 'accepted', reason: 'Checked the run' });
    expect(view.criteria[0]).toMatchObject({ state: 'proven', selfReviewed: false });
    expect(firstEvidence(view)).toMatchObject({ standing: 'accepted', canAccept: false, canReject: true });
    expect(firstEvidence(view).verdict).toMatchObject({ decision: 'accepted', channel: 'ui', actorAccountId: 'bob', independent: true, reason: 'Checked the run' });
    await expectError(service.recordVerdict('MOBL-1', BOB, { evidenceId: firstEvidence(pending).id, decision: 'accepted' }), 'conflict');
  });

  it('treats a person reviewing their own agent as an independent check', async () => {
    const pending = await contractWithEvidence(ALICES_AGENT);
    expect(firstEvidence(pending).channel).toBe('agent');
    const view = await service.recordVerdict('MOBL-1', ALICE, { evidenceId: firstEvidence(pending).id, decision: 'accepted' });
    expect(view.criteria[0]!.state).toBe('proven');
    expect(firstEvidence(view).verdict).toMatchObject({ independent: true, reason: 'Accepted.' });
  });

  it('does not let the agent that did the work record a verdict', async () => {
    const pending = await contractWithEvidence(ALICES_AGENT);
    await expectError(service.recordVerdict('MOBL-1', ALICES_AGENT, { evidenceId: firstEvidence(pending).id, decision: 'accepted', reason: 'Looks right to me' }), 'forbidden');
  });

  it('accepts a verdict from the verifier, with its reasoning', async () => {
    const pending = await contractWithEvidence(ALICE);
    const evidenceId = firstEvidence(pending).id;
    await expectError(service.recordVerdict('MOBL-1', VERIFIER, { evidenceId, decision: 'accepted', reason: 'ok' }), 'invalid');
    const view = await service.recordVerdict('MOBL-1', VERIFIER, {
      evidenceId,
      decision: 'accepted',
      reason: 'The linked run shows 120 passing tests for the login branch.',
    });
    expect(view.criteria[0]!.state).toBe('proven');
    expect(firstEvidence(view).verdict).toMatchObject({ channel: 'verifier', independent: true });
  });

  it('needs a reason to reject, and a rejection can be overturned', async () => {
    const pending = await contractWithEvidence(ALICES_AGENT);
    const evidenceId = firstEvidence(pending).id;
    await expectError(service.recordVerdict('MOBL-1', BOB, { evidenceId, decision: 'rejected', reason: ' ' }), 'invalid');
    await expectError(service.recordVerdict('MOBL-1', BOB, { evidenceId, decision: 'maybe' }), 'invalid');
    const rejected = await service.recordVerdict('MOBL-1', BOB, { evidenceId, decision: 'rejected', reason: 'The run is from another branch' });
    expect(rejected.criteria[0]!.state).toBe('rejected');
    expect(firstEvidence(rejected)).toMatchObject({ standing: 'rejected', canAccept: true, canReject: false });
    const accepted = await service.recordVerdict('MOBL-1', ALICE, { evidenceId, decision: 'accepted', reason: 'It is the right branch, see the commit' });
    expect(accepted.criteria[0]!.state).toBe('proven');
  });

  it('marks self-review when the project allows it', async () => {
    await store.saveSettings('10000', { ...DEFAULT_SETTINGS, requireIndependent: false });
    const pending = await contractWithEvidence(ALICE);
    expect(firstEvidence(pending).canAccept).toBe(true);
    const view = await service.recordVerdict('MOBL-1', ALICE, { evidenceId: firstEvidence(pending).id, decision: 'accepted' });
    expect(view.criteria[0]).toMatchObject({ state: 'proven', selfReviewed: true });
    expect(view.summary.selfReviewed).toBe(1);
    expect(firstEvidence(view)).toMatchObject({ standing: 'self_accepted', canAccept: false });
    // Someone else can still add the independent check.
    const upgraded = await service.recordVerdict('MOBL-1', BOB, { evidenceId: firstEvidence(pending).id, decision: 'accepted' });
    expect(upgraded.criteria[0]).toMatchObject({ state: 'proven', selfReviewed: false });
  });

  it('stops counting self-review once the project requires an independent check', async () => {
    await store.saveSettings('10000', { ...DEFAULT_SETTINGS, requireIndependent: false });
    const pending = await contractWithEvidence(ALICE);
    await service.recordVerdict('MOBL-1', ALICE, { evidenceId: firstEvidence(pending).id, decision: 'accepted' });
    await store.saveSettings('10000', { ...DEFAULT_SETTINGS, requireIndependent: true });
    const view = await service.view('MOBL-1', ALICE);
    expect(view.criteria[0]).toMatchObject({ state: 'submitted', needsIndependent: true });
  });
});

describe('attestations', () => {
  it('counts the word of a person who is not the assignee', async () => {
    jira.add(issueInfo({ description: DESCRIPTION, assigneeAccountId: 'alice' }));
    const created = await service.createContract('MOBL-1', ALICE, { withSuggestions: true });
    const view = await service.submitEvidence('MOBL-1', BOB, {
      criterionId: criterionId(created),
      kind: 'attestation',
      summary: 'I logged in on a test phone with email and password',
    });
    expect(view.criteria[0]!.state).toBe('proven');
    expect(firstEvidence(view).verdict).toMatchObject({ channel: 'attestation', actorAccountId: 'bob', independent: true });
  });

  it('asks for a second person when the assignee attests', async () => {
    jira.add(issueInfo({ description: DESCRIPTION, assigneeAccountId: 'alice' }));
    const created = await service.createContract('MOBL-1', ALICE, { withSuggestions: true });
    const view = await service.submitEvidence('MOBL-1', ALICE, {
      criterionId: criterionId(created),
      kind: 'attestation',
      summary: 'I logged in on a test phone with email and password',
    });
    expect(view.criteria[0]).toMatchObject({ state: 'submitted', needsIndependent: true });
    expect(firstEvidence(view).standing).toBe('self_accepted');
    const confirmed = await service.recordVerdict('MOBL-1', BOB, { evidenceId: firstEvidence(view).id, decision: 'accepted' });
    expect(confirmed.criteria[0]!.state).toBe('proven');
  });

  it('does not take an attestation from an agent', async () => {
    const created = await service.createContract('MOBL-1', ALICE, { withSuggestions: true });
    const view = await service.submitEvidence('MOBL-1', ALICES_AGENT, {
      criterionId: criterionId(created),
      kind: 'attestation',
      summary: 'I am confident that login works',
    });
    expect(firstEvidence(view).standing).toBe('failed_checks');
    expect(store.verdicts).toHaveLength(0);
  });
});

describe('the whole contract', () => {
  it('records when every criterion is proven and when that stops being true', async () => {
    const created = await service.addCriteria('MOBL-1', ALICE, [{ text: 'Login works' }, { text: 'Logout works' }]);
    for (const index of [0, 1]) {
      const view = await service.submitEvidence('MOBL-1', ALICES_AGENT, {
        criterionId: criterionId(created, index),
        kind: 'other',
        summary: `Screen recording of criterion ${index + 1}`,
        url: `https://example.com/recordings/${index + 1}`,
      });
      await service.recordVerdict('MOBL-1', BOB, { evidenceId: firstEvidence(view, index).id, decision: 'accepted' });
    }
    const proven = await service.view('MOBL-1', ALICE);
    expect(proven.summary).toMatchObject({ total: 2, proven: 2, state: 'proven' });
    expect(proven.gate).toMatchObject({ pass: true });
    expect(jira.properties.get('10001')).toMatchObject({ state: 'proven', proven: 2, total: 2, open: 0 });
    expect(store.eventTypes('10001').filter((t) => t.startsWith('proof.'))).toEqual(['proof.completed']);

    const reopened = await service.addCriteria('MOBL-1', ALICE, [{ text: 'Password reset works' }]);
    expect(reopened.summary.state).toBe('partial');
    expect(reopened.gate.pass).toBe(false);
    expect(store.eventTypes('10001').filter((t) => t.startsWith('proof.'))).toEqual(['proof.completed', 'proof.reopened']);
  });

  it('lists what happened, newest first', async () => {
    const pending = await contractWithEvidence(ALICES_AGENT);
    await service.recordVerdict('MOBL-1', BOB, { evidenceId: firstEvidence(pending).id, decision: 'rejected', reason: 'Wrong branch' });
    const history = await service.history('MOBL-1');
    expect(history.map((h) => h.type)).toEqual(['verdict.recorded', 'evidence.submitted', 'contract.created']);
    expect(history[0]).toMatchObject({ actorAccountId: 'bob', channel: 'ui', data: { decision: 'rejected', reason: 'Wrong branch' } });
    expect(history[1]).toMatchObject({ channel: 'agent', data: { kind: 'test_run', agentName: 'claude-code' } });
  });
});
