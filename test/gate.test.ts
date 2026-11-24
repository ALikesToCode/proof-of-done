import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../src/core/settings';
import { GateMode } from '../src/core/types';
import { Caller, ContractService } from '../src/services/contracts';
import { GateService, StatusChange } from '../src/services/gate';
import { toStatusChange } from '../src/triggers/issue-events';
import { doc, h, ul } from './helpers/adf';
import { FakeJira, MemoryStore, issueInfo } from './helpers/fakes';

const ALICE: Caller = { accountId: 'alice', via: 'ui' };
const BOB: Caller = { accountId: 'bob', via: 'ui' };
const AGENT: Caller = { accountId: 'alice', via: 'agent', agentName: 'claude-code' };
const DESCRIPTION = doc(h(2, 'Acceptance criteria'), ul('Login works', 'Logout works'));

let store: MemoryStore;
let jira: FakeJira;
let contracts: ContractService;
let gate: GateService;
let clock: number;

beforeEach(() => {
  store = new MemoryStore();
  jira = new FakeJira();
  clock = 1_700_000_000_000;
  const now = () => clock++;
  contracts = new ContractService(store, jira, now);
  gate = new GateService(store, jira, now);
  jira.add(issueInfo({ description: DESCRIPTION }));
});

/** Moves the fake work item to Done, the way a person would, and returns the event Jira would send. */
function closeIssue(overrides: Partial<StatusChange> = {}): StatusChange {
  const issue = jira.issues.get('10001')!;
  issue.statusName = 'Done';
  issue.statusCategory = 'done';
  return {
    issueId: '10001',
    fromStatusId: '3',
    fromStatusName: 'In Progress',
    fromCategory: 'indeterminate',
    actorAccountId: 'alice',
    changeId: '243660',
    occurredAt: 1_700_000_500_000,
    ...overrides,
  };
}

async function setMode(gateMode: GateMode, extra: Partial<typeof DEFAULT_SETTINGS> = {}): Promise<void> {
  await store.saveSettings('10000', { ...DEFAULT_SETTINGS, gateMode, ...extra });
}

async function proveEverything(): Promise<void> {
  const view = await contracts.createContract('MOBL-1', ALICE, { withSuggestions: true });
  for (const [index, criterion] of view.criteria.entries()) {
    const next = await contracts.submitEvidence('MOBL-1', AGENT, {
      criterionId: criterion.id,
      kind: 'other',
      summary: `Screen recording of criterion ${index + 1}`,
      url: `https://example.com/recordings/${index + 1}`,
    });
    await contracts.recordVerdict('MOBL-1', BOB, { evidenceId: next.criteria[index]!.evidence[0]!.id, decision: 'accepted' });
  }
}

const gateEvents = () => store.events.filter((e) => e.channel === 'jira').map((e) => e.type);

describe('the done gate on a status change', () => {
  it('ignores a change that does not cross the done line', async () => {
    const change: StatusChange = { issueId: '10001', fromStatusId: '1', fromStatusName: 'To Do', fromCategory: 'new', actorAccountId: 'alice', changeId: '1', occurredAt: 1 };
    expect(await gate.onStatusChange(change)).toBe('ignored');
    expect(store.events).toEqual([]);
  });

  it('lets a work item with no contract close', async () => {
    expect(await gate.onStatusChange(closeIssue())).toBe('passed');
    expect(jira.comments).toEqual([]);
    expect(store.events[0]).toMatchObject({ type: 'issue.done', actorAccountId: 'alice', data: { contract: false, proven: false, pass: true, status: 'Done' } });
  });

  it('lets a proven work item close and records it as proven', async () => {
    await proveEverything();
    expect(await gate.onStatusChange(closeIssue())).toBe('passed');
    expect(jira.comments).toEqual([]);
    expect(store.events.at(-1)).toMatchObject({ type: 'issue.done', data: { contract: true, proven: true, pass: true } });
  });

  it('comments when an unproven work item is closed and the project only warns', async () => {
    await contracts.createContract('MOBL-1', ALICE, { withSuggestions: true });
    expect(await gate.onStatusChange(closeIssue())).toBe('warned');
    expect(jira.issues.get('10001')!.statusName).toBe('Done');
    expect(jira.comments).toHaveLength(1);
    expect(jira.comments[0]!.paragraphs[0]).toBe(
      'MOBL-1 is Done, but it is not proven. 2 of 2 criteria are not proven (2 with no evidence).',
    );
    expect(gateEvents()).toEqual(['issue.done', 'gate.warned']);
    expect(store.events.find((e) => e.type === 'issue.done')).toMatchObject({ data: { proven: false, pass: false } });
  });

  it('moves an unproven work item back when the project bounces', async () => {
    await setMode('bounce');
    await contracts.createContract('MOBL-1', ALICE, { withSuggestions: true });
    expect(await gate.onStatusChange(closeIssue())).toBe('bounced');
    expect(jira.issues.get('10001')).toMatchObject({ statusName: 'In Progress', statusCategory: 'indeterminate' });
    expect(jira.comments[0]!.paragraphs[0]).toMatch(/^Proof of Done moved MOBL-1 back to In Progress\. 2 of 2 criteria are not proven/);
    expect(gateEvents()).toEqual(['gate.bounced']);
  });

  it('falls back to a comment when the workflow has no way back', async () => {
    await setMode('bounce');
    await contracts.createContract('MOBL-1', ALICE, { withSuggestions: true });
    jira.transitions = jira.transitions.filter((t) => t.toStatusId !== '3');
    expect(await gate.onStatusChange(closeIssue())).toBe('warned');
    expect(jira.issues.get('10001')!.statusName).toBe('Done');
    expect(store.events.at(-1)).toMatchObject({ type: 'gate.warned', data: { couldNotMoveBack: true } });
  });

  it('falls back to a comment when Jira refuses the move back', async () => {
    await setMode('bounce');
    await contracts.createContract('MOBL-1', ALICE, { withSuggestions: true });
    jira.failTransition = true;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(await gate.onStatusChange(closeIssue())).toBe('warned');
    expect(jira.issues.get('10001')!.statusName).toBe('Done');
    expect(jira.comments).toHaveLength(1);
    expect(store.events.at(-1)).toMatchObject({ type: 'gate.warned', data: { couldNotMoveBack: true, commented: true } });
    expect(warn).toHaveBeenCalledWith('Proof of Done: could not move MOBL-1 back. Error: Jira returned 400 when moving the work item.');
  });

  it('still records an unproven close when Jira refuses the comment', async () => {
    await contracts.createContract('MOBL-1', ALICE, { withSuggestions: true });
    jira.failComment = true;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(await gate.onStatusChange(closeIssue())).toBe('warned');
    expect(gateEvents()).toEqual(['issue.done', 'gate.warned']);
    expect(store.events.at(-1)).toMatchObject({ type: 'gate.warned', data: { commented: false } });
    expect(warn).toHaveBeenCalledWith('Proof of Done: could not comment on MOBL-1. Error: Jira returned 403 when commenting.');
  });

  it('does nothing about an unproven work item when the gate is off', async () => {
    await setMode('off');
    await contracts.createContract('MOBL-1', ALICE, { withSuggestions: true });
    expect(await gate.onStatusChange(closeIssue())).toBe('passed');
    expect(jira.comments).toEqual([]);
    expect(store.events.at(-1)).toMatchObject({ type: 'issue.done', data: { proven: false, pass: true } });
  });

  it('can require a contract', async () => {
    await setMode('warn', { enforceWithoutContract: true });
    expect(await gate.onStatusChange(closeIssue())).toBe('warned');
    expect(jira.comments[0]!.paragraphs[0]).toMatch(/has no done contract/);
  });

  it('records a reopen', async () => {
    const change: StatusChange = { issueId: '10001', fromStatusId: '5', fromStatusName: 'Done', fromCategory: 'done', actorAccountId: 'bob', changeId: '7', occurredAt: 7 };
    expect(await gate.onStatusChange(change)).toBe('reopened');
    expect(store.events[0]).toMatchObject({ type: 'issue.reopened', actorAccountId: 'bob', data: { fromStatus: 'Done', status: 'In Progress' } });
  });

  it('reacts once when Jira delivers the same event twice', async () => {
    await contracts.createContract('MOBL-1', ALICE, { withSuggestions: true });
    const change = closeIssue();
    expect(await gate.onStatusChange(change)).toBe('warned');
    expect(await gate.onStatusChange(change)).toBe('duplicate');
    expect(jira.comments).toHaveLength(1);
  });

  it('tells two closes apart by the id of the change, and by its time when Jira sent no id', async () => {
    expect(await gate.onStatusChange(closeIssue())).toBe('passed');
    expect(await gate.onStatusChange(closeIssue({ changeId: '243699' }))).toBe('passed');
    expect(await gate.onStatusChange(closeIssue({ changeId: null, occurredAt: 5 }))).toBe('passed');
    expect(await gate.onStatusChange(closeIssue({ changeId: null, occurredAt: 5 }))).toBe('duplicate');
    expect(await gate.onStatusChange(closeIssue({ changeId: null, occurredAt: null }))).toBe('passed');
    expect(store.events.map((e) => e.data['change'])).toEqual(['243660', '243699', 'at-5', null]);
  });

  it('looks the previous status up only when the event did not carry its category', async () => {
    await gate.onStatusChange(closeIssue());
    expect(jira.statusLookups).toBe(0);
    await gate.onStatusChange(closeIssue({ fromCategory: null, changeId: '243661' }));
    expect(jira.statusLookups).toBe(1);
  });

  it('ignores a work item the app cannot read', async () => {
    expect(await gate.onStatusChange(closeIssue({ issueId: '404' }))).toBe('ignored');
  });
});

describe('the workflow validator', () => {
  it('lets a work item with no contract through', async () => {
    expect(await gate.validate('MOBL-1')).toEqual({ result: true });
  });

  it('blocks an unproven work item and says what is missing', async () => {
    await contracts.createContract('MOBL-1', ALICE, { withSuggestions: true });
    const verdict = await gate.validate('MOBL-1', 'bob');
    expect(verdict.result).toBe(false);
    expect(verdict.errorMessage).toBe(
      'Proof of Done: 2 of 2 criteria are not proven (2 with no evidence). Add or review evidence in the Proof of Done panel.',
    );
    expect(store.events.at(-1)).toMatchObject({ type: 'gate.blocked', channel: 'jira', actorAccountId: 'bob' });
  });

  it('still blocks when the refusal cannot be stored', async () => {
    await contracts.createContract('MOBL-1', ALICE, { withSuggestions: true });
    store.insertEvent = async () => {
      throw new Error('The storage of this installation is full.');
    };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(await gate.validate('MOBL-1', 'bob')).toEqual({
      result: false,
      errorMessage: 'Proof of Done: 2 of 2 criteria are not proven (2 with no evidence). Add or review evidence in the Proof of Done panel.',
    });
    expect(store.eventTypes('10001')).not.toContain('gate.blocked');
    expect(warn).toHaveBeenCalledWith('Proof of Done: could not record the refusal for MOBL-1. Error: The storage of this installation is full.');
  });

  it('lets a proven work item through', async () => {
    await proveEverything();
    expect(await gate.validate('MOBL-1')).toEqual({ result: true });
  });

  it('stands down when the project turned its gate off', async () => {
    await setMode('off');
    await contracts.createContract('MOBL-1', ALICE, { withSuggestions: true });
    expect(await gate.validate('MOBL-1')).toEqual({ result: true });
  });

  it('does not block a work item it cannot read', async () => {
    expect(await gate.validate('NOPE-1')).toEqual({ result: true });
  });
});

describe('toStatusChange', () => {
  // Jira names the new status "toString", which shadows Object.prototype.toString in an inferred type.
  const items: Array<Record<string, unknown>> = [
    { field: 'resolution', from: null, to: '10000' },
    { field: 'status', fieldId: 'status', from: '3', fromString: 'In Progress', to: '5', toString: 'Done' },
  ];
  const event = {
    eventType: 'avi:jira:updated:issue',
    timestamp: '1700000500000',
    atlassianId: 'alice',
    issue: { id: '10001', key: 'MOBL-1' },
    changelog: { id: '243660', items },
    associatedStatuses: [
      { id: '3', name: 'In Progress', statusCategory: { key: 'indeterminate' } },
      { id: '5', name: 'Done', statusCategory: { key: 'done' } },
    ],
  };

  it('reads the status change out of an update event', () => {
    expect(toStatusChange(event)).toEqual({
      issueId: '10001',
      fromStatusId: '3',
      fromStatusName: 'In Progress',
      fromCategory: 'indeterminate',
      actorAccountId: 'alice',
      changeId: '243660',
      occurredAt: 1_700_000_500_000,
    });
  });

  it('copes with statuses nested under a key and with none at all', () => {
    expect(toStatusChange({ ...event, associatedStatuses: { statuses: event.associatedStatuses } })?.fromCategory).toBe('indeterminate');
    expect(toStatusChange({ ...event, associatedStatuses: undefined })?.fromCategory).toBeNull();
  });

  it('returns null when the status did not change or the payload is not an update', () => {
    expect(toStatusChange({ ...event, changelog: { items: [{ field: 'labels', from: null, to: null }] } })).toBeNull();
    expect(toStatusChange({ issue: { id: '1' } })).toBeNull();
    expect(toStatusChange(null)).toBeNull();
    expect(toStatusChange('status')).toBeNull();
  });
});
