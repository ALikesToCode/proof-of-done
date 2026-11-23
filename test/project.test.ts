import { beforeEach, describe, expect, it } from 'vitest';
import { SAMPLE_ITEMS } from '../src/core/sample';
import { DEFAULT_SETTINGS } from '../src/core/settings';
import { Caller, ContractService } from '../src/services/contracts';
import { GateService } from '../src/services/gate';
import { ProjectService, attentionOf, closedJql, openedJql } from '../src/services/project';
import { doc, h, ul } from './helpers/adf';
import { FakeJira, MemoryStore, issueInfo } from './helpers/fakes';

const ALICE: Caller = { accountId: 'alice', via: 'ui' };
const BOB: Caller = { accountId: 'bob', via: 'ui' };
const AGENT: Caller = { accountId: 'alice', via: 'agent', agentName: 'claude-code' };
const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_800_000_000_000;

let store: MemoryStore;
let jira: FakeJira;
let contracts: ContractService;
let projects: ProjectService;
let clock: number;

beforeEach(() => {
  store = new MemoryStore();
  jira = new FakeJira();
  clock = NOW;
  const now = () => clock++;
  jira.clock = () => clock;
  contracts = new ContractService(store, jira, now);
  projects = new ProjectService(store, jira, now);
});

/** Adds a work item with two criteria in its description. */
function addIssue(id: string, key: string, overrides: Parameters<typeof issueInfo>[0] = {}, createdDaysAgo = 1) {
  jira.add(issueInfo({ id, key, description: doc(h(2, 'Acceptance criteria'), ul('Login works', 'Logout works')), ...overrides }));
  jira.dates.set(id, { createdAt: NOW - createdDaysAgo * DAY, statusCategoryChangedAt: null });
}

async function prove(key: string): Promise<void> {
  const view = await contracts.createContract(key, ALICE, { withSuggestions: true });
  for (const [index, criterion] of view.criteria.entries()) {
    const next = await contracts.submitEvidence(key, AGENT, {
      criterionId: criterion.id,
      kind: 'other',
      summary: `Screen recording ${index + 1} of ${key}`,
      url: `https://example.com/${key}/${index + 1}`,
    });
    await contracts.recordVerdict(key, BOB, { evidenceId: next.criteria[index]!.evidence[0]!.id, decision: 'accepted' });
  }
}

function close(id: string): void {
  const issue = jira.issues.get(id)!;
  issue.statusName = 'Done';
  issue.statusCategory = 'done';
  jira.dates.get(id)!.statusCategoryChangedAt = clock;
}

describe('the project overview', () => {
  it('is stalled and empty for a project nobody touched', async () => {
    const view = await projects.overview('10000', 7);
    expect(view.project).toEqual({ id: '10000', key: 'MOBL', name: 'Mobile Dev' });
    expect(view.meter.verdict).toBe('stalled');
    expect(view.rows).toEqual([]);
    expect(view.contracts).toEqual({ total: 0, listed: 0, proven: 0, closedUnproven: 0, waiting: 0 });
    expect(view.settings).toEqual(DEFAULT_SETTINGS);
    expect(view.issueTypes).toEqual(['Bug', 'Story', 'Task']);
    expect(view.sample).toEqual({ loaded: 0, size: SAMPLE_ITEMS.length });
    expect(view.canAdmin).toBe(true);
  });

  it('asks Jira for work opened and closed in the window', async () => {
    await projects.overview('10000', 14);
    expect(jira.jqlSeen).toEqual([openedJql('10000', 14), closedJql('10000', 14)]);
    expect(openedJql('10000', 14)).toBe('project = 10000 AND created >= -14d');
    expect(closedJql('10000', 14)).toBe('project = 10000 AND statusCategory = Done AND statusCategoryChangedDate >= -14d');
  });

  it('is busy when work is closed without proof, and climbs once proven closures outrun new work', async () => {
    addIssue('1', 'MOBL-1');
    addIssue('2', 'MOBL-2', {}, 20);
    addIssue('3', 'MOBL-3', {}, 20);
    await contracts.createContract('MOBL-1', ALICE, { withSuggestions: true });
    close('1');
    let view = await projects.overview('10000', 7);
    expect(view.meter).toMatchObject({ opened: 1, closed: 1, closedProven: 0, closedUnproven: 1, closedNoContract: 0, verdict: 'busy' });
    expect(view.contracts).toMatchObject({ total: 1, listed: 1, closedUnproven: 1 });
    expect(view.rows[0]).toMatchObject({ key: 'MOBL-1', attention: 'closed_unproven', proofState: 'unproven', proven: 0, total: 2 });

    await prove('MOBL-2');
    await prove('MOBL-3');
    close('2');
    close('3');
    view = await projects.overview('10000', 7);
    expect(view.meter).toMatchObject({ opened: 1, closed: 3, closedProven: 2, closedUnproven: 1, verdict: 'climbing', evidence: 4, verdicts: 4 });
    expect(view.contracts).toMatchObject({ total: 3, proven: 2, closedUnproven: 1 });
  });

  it('counts a work item closed with no contract apart', async () => {
    addIssue('1', 'MOBL-1');
    close('1');
    const view = await projects.overview('10000', 7);
    expect(view.meter).toMatchObject({ closed: 1, closedProven: 0, closedUnproven: 0, closedNoContract: 1, verdict: 'busy' });
  });

  it('leaves a proven work item out of the window when it was closed before it', async () => {
    addIssue('1', 'MOBL-1', {}, 40);
    await prove('MOBL-1');
    close('1');
    jira.dates.get('1')!.statusCategoryChangedAt = NOW - 10 * DAY;
    expect((await projects.overview('10000', 7)).meter).toMatchObject({ closed: 0, closedProven: 0 });
    expect((await projects.overview('10000', 14)).meter).toMatchObject({ closed: 1, closedProven: 1, verdict: 'climbing' });
  });

  it('counts each reopened work item once', async () => {
    addIssue('1', 'MOBL-1', { statusName: 'In Progress', statusCategory: 'indeterminate' }, 30);
    const gate = new GateService(store, jira, () => clock++);
    const reopen = (changeId: string) =>
      gate.onStatusChange({ issueId: '1', fromStatusId: '5', fromStatusName: 'Done', fromCategory: 'done', actorAccountId: 'bob', changeId, occurredAt: clock });
    await reopen('a');
    await reopen('b');
    const view = await projects.overview('10000', 7);
    expect(view.meter).toMatchObject({ reopened: 1, verdict: 'busy' });
  });

  it('puts the work that needs attention first', async () => {
    addIssue('1', 'MOBL-1');
    addIssue('2', 'MOBL-2');
    addIssue('3', 'MOBL-3');
    addIssue('4', 'MOBL-4');
    await prove('MOBL-1');
    await contracts.createContract('MOBL-2', ALICE, { withSuggestions: true });
    const waiting = await contracts.createContract('MOBL-3', ALICE, { withSuggestions: true });
    await contracts.submitEvidence('MOBL-3', AGENT, {
      criterionId: waiting.criteria[0]!.id,
      kind: 'other',
      summary: 'Screen recording of the login',
      url: 'https://example.com/recording',
    });
    await contracts.createContract('MOBL-4', ALICE, { withSuggestions: true });
    close('4');
    const view = await projects.overview('10000', 7);
    expect(view.rows.map((r) => [r.key, r.attention])).toEqual([
      ['MOBL-4', 'closed_unproven'],
      ['MOBL-3', 'waiting'],
      ['MOBL-2', 'open'],
      ['MOBL-1', 'none'],
    ]);
    expect(view.rows[1]).toMatchObject({ waiting: 1, proofState: 'partial' });
    expect(view.contracts.waiting).toBe(1);
  });

  it('does not list a work item the viewer may not see, or one that was deleted', async () => {
    addIssue('1', 'MOBL-1');
    addIssue('2', 'MOBL-2');
    addIssue('3', 'MOBL-3');
    for (const key of ['MOBL-1', 'MOBL-2', 'MOBL-3']) await contracts.createContract(key, ALICE, { withSuggestions: true });
    jira.hidden.add('2');
    jira.issues.delete('3');
    const view = await projects.overview('10000', 7);
    expect(view.rows.map((r) => r.key)).toEqual(['MOBL-1']);
    expect(view.contracts).toMatchObject({ total: 3, listed: 1 });
  });

  it('refuses a project the viewer cannot see and a malformed id', async () => {
    await expect(projects.overview('99999', 7)).rejects.toMatchObject({ code: 'not_found' });
    await expect(projects.overview('10000 OR 1=1', 7)).rejects.toMatchObject({ code: 'invalid' });
  });

  it('ranks attention', () => {
    const row = { proofState: 'partial' as const, submitted: 1, rejected: 1 };
    expect(attentionOf(row, 'done')).toBe('closed_unproven');
    expect(attentionOf(row, 'indeterminate')).toBe('rejected');
    expect(attentionOf({ ...row, rejected: 0 }, 'new')).toBe('waiting');
    expect(attentionOf({ proofState: 'unproven', submitted: 0, rejected: 0 }, 'new')).toBe('open');
    expect(attentionOf({ proofState: 'proven', submitted: 0, rejected: 0 }, 'done')).toBe('none');
    expect(attentionOf({ proofState: 'none', submitted: 0, rejected: 0 }, 'done')).toBe('none');
  });
});

describe('project settings', () => {
  it('saves what an admin sends, cleaned up, and records the change', async () => {
    const saved = await projects.saveSettings('10000', 'alice', {
      gateMode: 'bounce',
      requireIndependent: true,
      enforceWithoutContract: true,
      rules: [{ text: '  All   tests pass ', requiredKind: 'test_run', issueTypes: ['Story'] }, { text: 'x' }],
      junk: 1,
    });
    expect(saved).toMatchObject({ gateMode: 'bounce', enforceWithoutContract: true });
    expect(saved.rules).toHaveLength(1);
    expect(saved.rules[0]).toMatchObject({ text: 'All tests pass', requiredKind: 'test_run', issueTypes: ['Story'] });
    expect((await projects.overview('10000', 7)).settings).toEqual(saved);
    expect(store.events.at(-1)).toMatchObject({ type: 'settings.changed', issueId: null, actorAccountId: 'alice', data: { gateMode: 'bounce', rules: 1 } });
  });

  it('is for project admins only', async () => {
    jira.admin = false;
    await expect(projects.saveSettings('10000', 'bob', { gateMode: 'off' })).rejects.toMatchObject({
      code: 'forbidden',
      message: 'You need to administer Mobile Dev to change these settings.',
    });
    expect((await store.getSettings('10000')).gateMode).toBe('warn');
    expect((await projects.overview('10000', 7)).canAdmin).toBe(false);
  });

  it('recounts the contracts when self-review starts or stops counting', async () => {
    addIssue('1', 'MOBL-1');
    const view = await contracts.createContract('MOBL-1', ALICE, { withSuggestions: true });
    for (const [index, criterion] of view.criteria.entries()) {
      const next = await contracts.submitEvidence('MOBL-1', ALICE, {
        criterionId: criterion.id,
        kind: 'other',
        summary: `Checked by hand, part ${index + 1}`,
        url: `https://example.com/notes/${index + 1}`,
      });
      await store.insertVerdict(
        {
          id: `self-${index}`,
          evidenceId: next.criteria[index]!.evidence[0]!.id,
          criterionId: criterion.id,
          issueId: '1',
          decision: 'accepted',
          reason: 'Accepted.',
          channel: 'ui',
          actorAccountId: 'alice',
          independent: false,
          createdAt: clock++,
        },
        '10000',
      );
    }
    expect((await projects.overview('10000', 7)).rows[0]).toMatchObject({ proofState: 'partial', proven: 0 });

    await projects.saveSettings('10000', 'alice', { ...DEFAULT_SETTINGS, requireIndependent: false });
    expect((await projects.overview('10000', 7)).rows[0]).toMatchObject({ proofState: 'proven', proven: 2 });
    expect(jira.properties.get('1')).toMatchObject({ state: 'proven', selfReviewed: 2 });

    await projects.saveSettings('10000', 'alice', { ...DEFAULT_SETTINGS, requireIndependent: true });
    expect((await projects.overview('10000', 7)).rows[0]).toMatchObject({ proofState: 'partial', proven: 0 });
  });
});
