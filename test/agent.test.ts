import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../src/core/settings';
import { AgentService, splitExcerpt, toDecisionWord, toKind } from '../src/services/agent';
import { Caller, ContractService } from '../src/services/contracts';
import { GraphService } from '../src/services/graph';
import { ProjectService } from '../src/services/project';
import { doc, h, p, ul } from './helpers/adf';
import { FakeGraph, FakeJira, MemoryStore, issueInfo } from './helpers/fakes';

const AGENT: Caller = { accountId: 'alice', via: 'agent', agentName: 'claude-code' };
const ALICE: Caller = { accountId: 'alice', via: 'ui' };
const BOB: Caller = { accountId: 'bob', via: 'ui' };
const VERIFIER: Caller = { accountId: 'alice', via: 'verifier' };
const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_800_000_000_000;
const HIDDEN = 'No criterion you can see has that id. Call get-done-contract for the ids of the criteria.';

let store: MemoryStore;
let jira: FakeJira;
let graph: FakeGraph;
let contracts: ContractService;
let agent: AgentService;
let clock: number;

/** Adds a work item whose description lists the given acceptance criteria. */
function addIssue(id: string, key: string, criteria: string[], overrides: Parameters<typeof issueInfo>[0] = {}) {
  const body = criteria.length > 0 ? [h(2, 'Acceptance criteria'), ul(...criteria)] : [];
  jira.add(issueInfo({ id, key, description: doc(p('Customers reported brute force attempts.'), ...body), ...overrides }));
  jira.dates.set(id, { createdAt: NOW - DAY, statusCategoryChangedAt: null });
}

const testRun = (criterionId: string, extra: Record<string, unknown> = {}) => ({
  criterionId,
  kind: 'test_run',
  summary: 'The lockout tests pass on the branch.',
  passed: 14,
  failed: 0,
  ...extra,
});

beforeEach(() => {
  store = new MemoryStore();
  jira = new FakeJira();
  clock = NOW;
  const now = () => clock++;
  jira.clock = () => clock;
  contracts = new ContractService(store, jira, now);
  graph = new FakeGraph();
  agent = new AgentService(contracts, new ProjectService(store, jira, now), jira, store, new GraphService(contracts, graph, 50));
  addIssue('1', 'MOBL-1', ['The account locks after five failed sign-ins', 'A locked account gets an email'], {
    summary: 'Lock an account after five failed sign-ins',
  });
});

describe('reading a contract as an agent', () => {
  it('says to start the contract when the work item has none', async () => {
    const contract = await agent.contract('MOBL-1', AGENT);
    expect(contract).toMatchObject({
      workItem: { key: 'MOBL-1', summary: 'Lock an account after five failed sign-ins', type: 'Story', status: 'In Progress', done: false },
      hasContract: false,
      proof: { state: 'none', proven: 0, total: 0 },
      criteria: [],
    });
    expect(contract.suggested).toEqual([
      { text: 'The account locks after five failed sign-ins', needs: 'any', from: 'the description' },
      { text: 'A locked account gets an email', needs: 'any', from: 'the description' },
    ]);
    expect(contract.next).toBe(
      'This work item has no done contract yet. Call start-done-contract to create it from the 2 criteria found in its description and the project rules.',
    );
  });

  it('sends the agent to a person when the ticket describes no criteria', async () => {
    addIssue('2', 'MOBL-2', []);
    const contract = await agent.contract('MOBL-2', AGENT);
    expect(contract.suggested).toBeUndefined();
    expect(contract.next).toContain('Ask a person to write the contract');
    await expect(agent.start('MOBL-2', AGENT)).rejects.toMatchObject({ code: 'invalid' });
    expect(store.contracts.size).toBe(0);
  });

  it('starts the contract from the description, and starting it twice is harmless', async () => {
    const started = await agent.start('MOBL-1', AGENT);
    expect(started.hasContract).toBe(true);
    expect(started.suggested).toBeUndefined();
    expect(started.criteria.map((c) => [c.text, c.needs, c.state])).toEqual([
      ['The account locks after five failed sign-ins', 'any', 'no_evidence'],
      ['A locked account gets an email', 'any', 'no_evidence'],
    ]);
    expect(started.criteria[0]!.next).toBe('Submit evidence.');
    expect(started.gate).toEqual({ passes: false, mode: 'warn', reason: '2 of 2 criteria are not proven (2 with no evidence).' });
    expect(started.next).toBe(
      '2 criteria still need evidence. Call submit-evidence once for each, with a test run, a build, a pull request, a document, or other evidence that has a link or an excerpt. Do not move the work item to a done status before every criterion is proven.',
    );

    const again = await agent.start('MOBL-1', AGENT);
    expect(again.criteria.map((c) => c.id)).toEqual(started.criteria.map((c) => c.id));
    expect(store.eventTypes('1')).toEqual(['contract.created']);
  });

  it('names the kind of evidence a criterion takes', async () => {
    await store.saveSettings('10000', {
      ...DEFAULT_SETTINGS,
      rules: [
        { id: 'r1', text: 'All tests pass', requiredKind: 'test_run', issueTypes: [] },
        { id: 'r2', text: 'The product owner signed off', requiredKind: 'attestation', issueTypes: [] },
      ],
    });
    const contract = await agent.start('MOBL-1', AGENT);
    const byText = (text: string) => contract.criteria.find((c) => c.text === text)!;
    expect(byText('All tests pass')).toMatchObject({ needs: 'test_run' });
    expect(byText('All tests pass').next).toBe('Submit a test run with the numbers of passed and failed tests.');
    expect(byText('The product owner signed off').next).toBe(
      'Only a person can prove this one. Ask a person to add their attestation in the Proof of Done panel.',
    );
  });
});

describe('submitting evidence as an agent', () => {
  it('records evidence by criterion id alone and reports the checks at once', async () => {
    const [first] = (await agent.start('MOBL-1', AGENT)).criteria;
    const result = await agent.submit(
      testRun(first!.id, { excerpt: '$ npm test -- lockout\n14 passed (14)', commit: 'a1b2c3d', url: 'https://ci.example.com/runs/88' }),
      AGENT,
    );
    expect(result).toMatchObject({ passedChecks: true, problems: [], proof: { state: 'unproven', proven: 0, total: 2 } });
    expect(result.criterion.state).toBe('waiting_for_review');
    expect(result.criterion.evidence[0]).toMatchObject({
      id: result.evidenceId,
      kind: 'test_run',
      url: 'https://ci.example.com/runs/88',
      details: { passed: 14, failed: 0, command: 'npm test -- lockout', commit: 'a1b2c3d', text: '14 passed (14)' },
      submittedBy: 'the agent claude-code',
      standing: 'waiting_for_review',
    });
    expect(result.next).toBe(
      'Recorded. It passed the automatic checks and now waits for a review by a person or the Proof Verifier. You cannot accept it yourself. 1 criterion still needs evidence.',
    );
    expect(store.evidence[0]).toMatchObject({ channel: 'agent', actorAccountId: 'alice', agentName: 'claude-code' });
  });

  it('turns a failing run away and says why', async () => {
    const [first] = (await agent.start('MOBL-1', AGENT)).criteria;
    const result = await agent.submit(testRun(first!.id, { failed: 2 }), AGENT);
    expect(result.passedChecks).toBe(false);
    expect(result.problems).toEqual(['2 tests failed, so this run proves nothing yet.']);
    expect(result.criterion.state).toBe('rejected');
    expect(result.criterion.next).toBe(
      'Submit new evidence. The last one failed the automatic checks. 2 tests failed, so this run proves nothing yet.',
    );
    expect(result.next).toBe('Recorded, and turned away by the automatic checks. Fix what the problems say and submit again.');
  });

  it('forgives the way a model writes a kind', async () => {
    expect(toKind('Test run')).toBe('test_run');
    expect(toKind('pull-request')).toBe('pull_request');
    expect(toKind(' PR ')).toBe('pull_request');
    expect(toKind('build')).toBe('build');
    const [first] = (await agent.start('MOBL-1', AGENT)).criteria;
    const result = await agent.submit(testRun(first!.id, { kind: 'Tests' }), AGENT);
    expect(result.criterion.evidence[0]!.kind).toBe('test_run');
    await expect(agent.submit(testRun(first!.id, { kind: 'vibes' }), AGENT)).rejects.toThrow(
      'Unknown evidence kind "vibes". Use one of: test_run, build, pull_request, document, attestation, other.',
    );
  });

  it('reads the command from the first line of the excerpt', () => {
    expect(splitExcerpt('$ pytest tests/auth -q\n14 passed in 2.1s')).toEqual({ command: 'pytest tests/auth -q', text: '14 passed in 2.1s' });
    expect(splitExcerpt('14 passed in 2.1s')).toEqual({ command: '', text: '14 passed in 2.1s' });
    expect(splitExcerpt('$ make test')).toEqual({ command: 'make test', text: '' });
    expect(splitExcerpt('')).toEqual({ command: '', text: '' });
  });

  it('does not let an agent attest', async () => {
    const [first] = (await agent.start('MOBL-1', AGENT)).criteria;
    const result = await agent.submit({ criterionId: first!.id, kind: 'attestation', summary: 'I checked it and it works fine.' }, AGENT);
    expect(result.passedChecks).toBe(false);
    expect(result.problems).toEqual(['Only a person can attest. An agent has to submit another kind of evidence.']);
    expect(store.verdicts).toEqual([]);
  });

  it('answers the same for a criterion that is not there and one the caller may not see', async () => {
    const [first] = (await agent.start('MOBL-1', AGENT)).criteria;
    await expect(agent.submit(testRun('01JUNKJUNKJUNKJUNKJUNKJUNK0'), AGENT)).rejects.toThrow(HIDDEN);
    await expect(agent.submit(testRun(''), AGENT)).rejects.toThrow(HIDDEN);
    jira.issues.delete('1');
    await expect(agent.submit(testRun(first!.id), AGENT)).rejects.toThrow(HIDDEN);
    expect(store.evidence).toEqual([]);
  });

  it('needs the caller to be allowed to edit the work item', async () => {
    const [first] = (await agent.start('MOBL-1', AGENT)).criteria;
    jira.editable = false;
    await expect(agent.submit(testRun(first!.id), AGENT)).rejects.toMatchObject({ code: 'forbidden' });
  });
});

describe('the context pack', () => {
  it('gathers what surrounds the work item, with its contract and the rules', async () => {
    jira.add(issueInfo({ id: '9', key: 'MOBL-9', summary: 'Sign-in hardening', issueType: 'Epic', description: doc(p('Stop credential stuffing this quarter.')) }));
    jira.issues.get('1')!.parentKey = 'MOBL-9';
    jira.contexts.set('1', {
      priority: 'High',
      assignee: 'Alice Example',
      labels: ['security'],
      links: [{ relation: 'is blocked by', key: 'MOBL-7', summary: 'Rate limiter', statusName: 'In Progress' }],
      subtasks: [{ key: 'MOBL-8', summary: 'Email template', statusName: 'To Do' }],
      comments: [
        { author: 'Bob Example', at: '2026-11-20T10:00:00.000+0000', text: 'Use the existing lockout table.' },
        { author: 'Bob Example', at: '2026-11-19T10:00:00.000+0000', text: '' },
      ],
      commentTotal: 7,
    });
    const pack = await agent.contextPack('MOBL-1', AGENT);
    expect(pack.workItem).toEqual({
      key: 'MOBL-1',
      summary: 'Lock an account after five failed sign-ins',
      type: 'Story',
      status: 'In Progress',
      done: false,
      priority: 'High',
      assignee: 'Alice Example',
      labels: ['security'],
    });
    expect(pack.description).toContain('Customers reported brute force attempts.');
    expect(pack.description).toContain('A locked account gets an email');
    expect(pack.descriptionCut).toBeUndefined();
    expect(pack.parent).toEqual({ key: 'MOBL-9', summary: 'Sign-in hardening', type: 'Epic', status: 'In Progress', description: 'Stop credential stuffing this quarter.' });
    expect(pack.links).toEqual([{ relation: 'is blocked by', key: 'MOBL-7', summary: 'Rate limiter', status: 'In Progress' }]);
    expect(pack.subtasks).toEqual([{ key: 'MOBL-8', summary: 'Email template', status: 'To Do' }]);
    expect(pack.comments).toEqual([{ author: 'Bob Example', at: '2026-11-20T10:00:00.000+0000', text: 'Use the existing lockout table.' }]);
    expect(pack.commentTotal).toBe(7);
    expect(pack.contract.hasContract).toBe(false);
    expect(pack.rules).toHaveLength(7);
    expect(pack.rules[5]).toBe(
      "When you submit a pull request or a build, the reviewer sees whether Jira's Teamwork Graph links it to the work item. Jira links a pull request or a build to a work item when the work item key is in the branch name, the pull request title or a commit message.",
    );
    expect(pack.rules[6]).toBe(
      'Do not move the work item to a done status before every criterion is proven. The done gate comments on work that is closed without proof.',
    );
  });

  it('leaves out what is empty and cuts a description that is too long', async () => {
    addIssue('2', 'MOBL-2', []);
    jira.issues.get('2')!.description = doc(p('x'.repeat(20_000)));
    await store.saveSettings('10000', { ...DEFAULT_SETTINGS, gateMode: 'off' });
    const pack = await agent.contextPack('MOBL-2', AGENT);
    expect(Object.keys(pack)).toEqual(['workItem', 'description', 'descriptionCut', 'contract', 'rules']);
    expect(pack.description.length).toBeLessThan(12_010);
    expect(pack.descriptionCut).toBe(true);
    expect(pack.rules).toHaveLength(6);
  });
});

describe('listing unproven work', () => {
  it('puts work closed without proof first and says what each item needs', async () => {
    addIssue('2', 'MOBL-2', ['Audit rows export as CSV']);
    addIssue('3', 'MOBL-3', ['Session ends after 15 idle minutes']);
    const [lock] = (await agent.start('MOBL-1', AGENT)).criteria;
    await agent.submit(testRun(lock!.id), AGENT);
    await agent.start('MOBL-2', AGENT);
    const [idle] = (await agent.start('MOBL-3', AGENT)).criteria;
    const submitted = await agent.submit(testRun(idle!.id), AGENT);
    await contracts.recordVerdict('MOBL-3', BOB, { evidenceId: submitted.evidenceId, decision: 'accepted' });
    const closed = jira.issues.get('2')!;
    closed.statusName = 'Done';
    closed.statusCategory = 'done';
    jira.dates.get('2')!.statusCategoryChangedAt = clock;

    const work = await agent.unproven('MOBL', 7);
    expect(work.project).toEqual({ key: 'MOBL', name: 'Mobile Dev' });
    expect(work.meter).toMatchObject({ verdict: 'busy', windowDays: 7 });
    expect(work.contracts).toEqual({ total: 3, proven: 1, closedWithoutProof: 1, waitingForReview: 1 });
    expect(work.workItems.map((w) => [w.key, w.done, w.proof, w.note])).toEqual([
      ['MOBL-2', true, '0 of 1 proven', 'Closed without proof. 1 criterion has no evidence.'],
      ['MOBL-1', false, '0 of 2 proven', '1 criterion has no evidence. 1 criterion waits for a review.'],
    ]);
    expect(work.more).toBeUndefined();
    expect(work.next).toBe('Call get-done-contract on a work item to see what each criterion needs.');
    expect((await agent.unproven('10000', 30)).meter.windowDays).toBe(30);
  });

  it('says so when nothing is unproven, and refuses a project it cannot find', async () => {
    expect((await agent.unproven('MOBL', 7)).next).toBe('No work item in this project has a done contract yet.');
    await expect(agent.unproven('NOPE', 7)).rejects.toMatchObject({ code: 'not_found' });
    await expect(agent.unproven('not a key', 7)).rejects.toMatchObject({ code: 'invalid' });
    await expect(agent.unproven(undefined, 7)).rejects.toMatchObject({ code: 'invalid' });
  });
});

describe('reviewing evidence as the verifier', () => {
  it('lists only evidence that waits, with what a reviewer needs', async () => {
    const [lock, email] = (await agent.start('MOBL-1', AGENT)).criteria;
    await agent.submit(testRun(lock!.id, { excerpt: '$ npm test\n14 passed' }), AGENT);
    await agent.submit(testRun(email!.id, { failed: 3 }), AGENT);
    const queue = await agent.reviewQueue('MOBL-1', VERIFIER);
    expect(queue.workItem.key).toBe('MOBL-1');
    expect(queue.description).toContain('Customers reported brute force attempts.');
    expect(queue.waiting).toHaveLength(1);
    expect(queue.waiting[0]).toMatchObject({
      criterionId: lock!.id,
      criterion: 'The account locks after five failed sign-ins',
      needs: 'any',
      kind: 'test_run',
      details: { passed: 14, failed: 0, command: 'npm test', text: '14 passed' },
      submittedBy: 'the agent claude-code',
    });
    expect(queue.waiting[0]!.checks).toContain('14 tests passed.');
    expect(queue.rules).toHaveLength(5);
    expect(queue.next).toBe('Call record-verdict for the one piece of evidence that waits.');
  });

  it('says when there is nothing to review', async () => {
    expect((await agent.reviewQueue('MOBL-1', VERIFIER)).next).toBe('This work item has no done contract, so there is nothing to review.');
    await agent.start('MOBL-1', AGENT);
    expect((await agent.reviewQueue('MOBL-1', VERIFIER)).next).toBe('No evidence waits for a review on this work item.');
  });

  it('records a verdict with its reasoning and reports what is left', async () => {
    const [lock, email] = (await agent.start('MOBL-1', AGENT)).criteria;
    const one = await agent.submit(testRun(lock!.id), AGENT);
    const two = await agent.submit(testRun(email!.id, { summary: 'The same lockout tests pass.' }), AGENT);

    const rejected = await agent.verdict(
      { issueKey: 'MOBL-1', evidenceId: two.evidenceId, decision: 'reject', reason: 'The run covers the lockout. Nothing in it shows that an email is sent.' },
      VERIFIER,
    );
    expect(rejected).toMatchObject({ decision: 'rejected', proof: { proven: 0, total: 2 } });
    expect(rejected.criterion.state).toBe('rejected');
    expect(rejected.criterion.next).toBe(
      'Submit new evidence. The last one was rejected. The run covers the lockout. Nothing in it shows that an email is sent.',
    );
    expect(rejected.next).toBe('1 more piece of evidence waits for a review on this work item.');

    const accepted = await agent.verdict(
      { issueKey: 'MOBL-1', evidenceId: one.evidenceId, decision: 'Approve', reason: 'Fourteen lockout tests passed with none failing.' },
      VERIFIER,
    );
    expect(accepted.decision).toBe('accepted');
    expect(accepted.criterion.state).toBe('proven');
    expect(accepted.criterion.evidence[0]!.verdict).toEqual({
      decision: 'accepted',
      reason: 'Fourteen lockout tests passed with none failing.',
      by: 'the Proof Verifier',
    });
    expect(accepted.next).toBe('No other evidence waits for a review on this work item.');
    expect(store.verdicts.map((v) => [v.channel, v.independent, v.actorAccountId])).toEqual([
      ['verifier', true, 'alice'],
      ['verifier', true, 'alice'],
    ]);
  });

  it('wants reasoning from the verifier, and a decision it knows', async () => {
    const [lock] = (await agent.start('MOBL-1', AGENT)).criteria;
    const one = await agent.submit(testRun(lock!.id), AGENT);
    const call = (decision: string, reason: string) => agent.verdict({ issueKey: 'MOBL-1', evidenceId: one.evidenceId, decision, reason }, VERIFIER);
    await expect(call('accepted', 'ok')).rejects.toThrow('Give the reasoning behind the verdict in a sentence or two.');
    await expect(call('maybe', 'It might be fine, hard to say.')).rejects.toThrow('A verdict is either "accepted" or "rejected".');
    expect(toDecisionWord('Accept')).toBe('accepted');
    expect(toDecisionWord('declined')).toBe('rejected');
    expect(store.verdicts).toEqual([]);
  });

  it('says every criterion is proven after the last acceptance', async () => {
    addIssue('2', 'MOBL-2', ['Audit rows export as CSV']);
    const [only] = (await agent.start('MOBL-2', AGENT)).criteria;
    const one = await agent.submit(testRun(only!.id), AGENT);
    const result = await agent.verdict(
      { issueKey: 'MOBL-2', evidenceId: one.evidenceId, decision: 'accepted', reason: 'The export test passed and the excerpt shows the CSV header.' },
      VERIFIER,
    );
    expect(result.next).toBe('No other evidence waits for a review on this work item. Every criterion is now proven.');
    expect(result.gate.passes).toBe(true);
    expect((await agent.contract('MOBL-2', AGENT)).next).toBe('The one criterion is proven. The work item can be closed.');
  });

  it('offers evidence its own submitter accepted, when the project wants a second person', async () => {
    await store.saveSettings('10000', { ...DEFAULT_SETTINGS, requireIndependent: false });
    const view = await contracts.createContract('MOBL-1', ALICE, { withSuggestions: true });
    const added = await contracts.addEvidence('MOBL-1', ALICE, {
      criterionId: view.criteria[0]!.id,
      kind: 'other',
      summary: 'Screen recording of the lockout.',
      url: 'https://example.com/recording',
    });
    await contracts.recordVerdict('MOBL-1', ALICE, { evidenceId: added.evidenceId, decision: 'accepted' });
    expect((await agent.reviewQueue('MOBL-1', VERIFIER)).waiting).toEqual([]);
    await store.saveSettings('10000', { ...DEFAULT_SETTINGS, requireIndependent: true });
    const queue = await agent.reviewQueue('MOBL-1', VERIFIER);
    expect(queue.waiting.map((w) => [w.evidenceId, w.submittedBy])).toEqual([[added.evidenceId, 'a person']]);
  });
});

describe('what the Teamwork Graph adds', () => {
  const PR = 'https://github.com/acme/mobile/pull/12';
  const RUN = 'https://github.com/acme/mobile/actions/runs/881';
  const RECORDED = 'Recorded. It passed the automatic checks and now waits for a review by a person or the Proof Verifier. You cannot accept it yourself.';
  const HOW_JIRA_LINKS =
    'Jira links a pull request or a build to a work item when the work item key is in the branch name, the pull request title or a commit message.';

  const pullRequest = (criterionId: string, extra: Record<string, unknown> = {}) => ({
    criterionId,
    kind: 'pull_request',
    summary: 'The change that locks the account.',
    url: PR,
    status: 'merged',
    ...extra,
  });

  it('tells the agent at once what Jira holds about its pull request', async () => {
    const [first] = (await agent.start('MOBL-1', AGENT)).criteria;
    graph.link('1', [{ state: 'merged' }]);
    const result = await agent.submit(pullRequest(first!.id), AGENT);
    expect(result.graph).toBe('The Teamwork Graph links this pull request to the work item and has it as merged.');
    expect(result.next).toBe(`${RECORDED} 1 criterion still needs evidence.`);
    expect(graph.asked).toEqual(['1']);
  });

  it('says how Jira links a pull request when it does not link this one', async () => {
    const [first] = (await agent.start('MOBL-1', AGENT)).criteria;
    graph.link('1', [{ url: 'https://github.com/acme/mobile/pull/7' }]);
    const result = await agent.submit(pullRequest(first!.id), AGENT);
    expect(result.passedChecks).toBe(true);
    expect(result.graph).toBe('The Teamwork Graph links 1 pull request to this work item, and this link is not one of them.');
    expect(result.next).toBe(`${RECORDED} ${HOW_JIRA_LINKS} 1 criterion still needs evidence.`);
  });

  it('does not ask the graph about a test run, or about evidence the checks turned away', async () => {
    const [first] = (await agent.start('MOBL-1', AGENT)).criteria;
    expect((await agent.submit(testRun(first!.id, { url: 'https://ci.example.com/runs/88' }), AGENT)).graph).toBeUndefined();
    const notAPullRequest = await agent.submit(pullRequest(first!.id, { url: 'https://github.com/acme/mobile' }), AGENT);
    expect(notAPullRequest.passedChecks).toBe(false);
    expect(notAPullRequest.graph).toBeUndefined();
    expect(graph.asked).toEqual([]);
  });

  it('records the evidence all the same when the graph is down or too slow', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const [first] = (await agent.start('MOBL-1', AGENT)).criteria;
    for (const mood of ['down', 'slow', 'silent'] as const) {
      graph.mood = mood;
      // The app turns away the same evidence twice, so each try words it differently.
      const result = await agent.submit(pullRequest(first!.id, { summary: `The change that locks the account, with the graph ${mood}.` }), AGENT);
      expect(result, mood).toMatchObject({ passedChecks: true, problems: [] });
      expect(result.graph, mood).toBeUndefined();
      expect(result.next, mood).toBe(`${RECORDED} 1 criterion still needs evidence.`);
    }
    expect(store.evidence).toHaveLength(3);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('lists what Jira links to the work item in the context pack', async () => {
    graph.link(
      '1',
      [
        {},
        { kind: 'build', name: 'CI 881', url: RUN, state: 'in_progress' },
        { kind: 'deployment', name: 'Deploy 44', url: null, state: 'successful', environment: 'production', provider: null, updatedAt: null },
      ],
      ['build'],
    );
    const pack = await agent.contextPack('MOBL-1', AGENT);
    expect(pack.development).toEqual([
      {
        kind: 'pull_request',
        name: '#12 Lock accounts after five failed sign-ins',
        url: PR,
        state: 'merged',
        provider: 'GitHub',
        updatedAt: '2026-11-20T10:00:00.000Z',
      },
      { kind: 'build', name: 'CI 881', url: RUN, state: 'in progress', provider: 'GitHub', updatedAt: '2026-11-20T10:00:00.000Z' },
      { kind: 'deployment', name: 'Deploy 44', state: 'successful', environment: 'production' },
    ]);
    expect(pack.developmentCut).toBe(true);
    expect(Object.keys(pack)).toEqual(['workItem', 'description', 'development', 'developmentCut', 'contract', 'rules']);
  });

  it('leaves development out of the context pack when nothing is linked or the graph has no answer', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    for (const mood of ['up', 'down', 'silent'] as const) {
      graph.mood = mood;
      const pack = await agent.contextPack('MOBL-1', AGENT);
      expect(Object.keys(pack), mood).toEqual(['workItem', 'description', 'contract', 'rules']);
    }
  });

  it('gives the verifier the graph line next to the evidence, and the rule for reading it', async () => {
    const [lock, email] = (await agent.start('MOBL-1', AGENT)).criteria;
    await agent.submit(pullRequest(lock!.id), AGENT);
    await agent.submit(testRun(email!.id), AGENT);
    graph.link('1', [{ state: 'open' }]);
    graph.asked = [];

    const queue = await agent.reviewQueue('MOBL-1', VERIFIER);
    expect(queue.waiting.map((item) => [item.kind, item.graph])).toEqual([
      ['pull_request', 'The evidence says this pull request is merged, but the Teamwork Graph has it as open.'],
      ['test_run', undefined],
    ]);
    expect(queue.rules).toHaveLength(6);
    expect(queue.rules[5]).toBe(
      "A `graph` line says what Jira's Teamwork Graph holds about the pull request or build behind an entry. Jira got it from the tool itself, so trust it over what the evidence says about itself. Where it says the two differ, reject unless the evidence explains the difference. Where it says the link is not among the ones Jira links to the work item, the link alone proves nothing.",
    );
    // One question covers the whole queue.
    expect(graph.asked).toEqual(['1']);
  });

  it('keeps the graph out of a review queue it has no say on, and out of one it cannot answer for', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const [lock, email] = (await agent.start('MOBL-1', AGENT)).criteria;
    await agent.submit(testRun(lock!.id), AGENT);
    const plain = await agent.reviewQueue('MOBL-1', VERIFIER);
    expect(plain.waiting).toHaveLength(1);
    expect(plain.rules).toHaveLength(5);
    expect(graph.asked).toEqual([]);

    graph.mood = 'down';
    await agent.submit(pullRequest(email!.id), AGENT);
    const queue = await agent.reviewQueue('MOBL-1', VERIFIER);
    expect(queue.waiting).toHaveLength(2);
    expect(queue.waiting.every((item) => item.graph === undefined)).toBe(true);
    expect(queue.rules).toHaveLength(5);
  });
});
