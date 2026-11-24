import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adfText } from '../src/core/adf';
import { PodError } from '../src/core/errors';
import { extractCriteria } from '../src/core/extract';
import { SAMPLE_ITEMS, SAMPLE_LABEL } from '../src/core/sample';
import { DEFAULT_SETTINGS } from '../src/core/settings';
import { Caller, ContractService } from '../src/services/contracts';
import { ProjectService } from '../src/services/project';
import { SampleService, buildSampleRows, pickIssueType, sampleDescription } from '../src/services/sample';
import { doc, h, ul } from './helpers/adf';
import { FakeJira, MemoryStore, issueInfo } from './helpers/fakes';

const ALICE: Caller = { accountId: 'alice', via: 'ui' };
const BOB: Caller = { accountId: 'bob', via: 'ui' };
const NOW = 1_800_000_000_000;

let store: MemoryStore;
let jira: FakeJira;
let contracts: ContractService;
let projects: ProjectService;
let samples: SampleService;
let clock: number;

beforeEach(() => {
  store = new MemoryStore();
  jira = new FakeJira();
  clock = NOW;
  const now = () => clock++;
  jira.clock = () => clock;
  contracts = new ContractService(store, jira, now);
  projects = new ProjectService(store, jira, now);
  samples = new SampleService(store, jira, now);
});

describe('the sample data', () => {
  const loadAll = async () => {
    const steps = [];
    for (let i = 0; i < SAMPLE_ITEMS.length; i++) steps.push(await samples.loadOne('10000', i));
    return steps;
  };
  const bySlug = async (slug: string) => jira.issues.get((await store.listSampleIssues('10000')).find((s) => s.slug === slug)!.issueId)!;

  it('writes a description the app can read its own criteria from', () => {
    for (const item of SAMPLE_ITEMS) {
      const description = sampleDescription(item);
      expect(extractCriteria(description).map((c) => c.text)).toEqual(item.criteria.map((c) => c.text));
      expect(adfText(description)).toContain('Sample data from Proof of Done.');
      expect(item.summary.startsWith('Sample: ')).toBe(true);
    }
  });

  it('builds rows that tell the story each sample is there for', () => {
    const state = (slug: string) => buildSampleRows(SAMPLE_ITEMS.find((i) => i.slug === slug)!, '1', NOW).summary;
    expect(state('account-lockout')).toMatchObject({ state: 'proven', proven: 3, total: 3 });
    expect(state('reset-link')).toMatchObject({ state: 'unproven', proven: 0, rejected: 1, unproven: 2 });
    expect(state('audit-export')).toMatchObject({ state: 'partial', proven: 1, submitted: 2 });
    expect(state('payment-sdk')).toMatchObject({ state: 'unproven', proven: 0, unproven: 3 });
  });

  it('runs the real checks on sample evidence and names no person', () => {
    const rows = buildSampleRows(SAMPLE_ITEMS.find((i) => i.slug === 'reset-link')!, '1', NOW);
    expect(rows.evidence[0]).toMatchObject({ checksPassed: false, channel: 'sample', actorAccountId: null, agentName: 'claude-code' });
    expect(rows.evidence[0]!.checks.find((c) => !c.ok)?.note).toBe('2 tests failed, so this run proves nothing yet.');
    expect(rows.verdicts).toEqual([]);
    const proven = buildSampleRows(SAMPLE_ITEMS.find((i) => i.slug === 'account-lockout')!, '1', NOW);
    expect(proven.evidence.every((e) => e.checksPassed)).toBe(true);
    expect(proven.verdicts.every((v) => v.channel === 'sample' && v.independent && v.actorAccountId === null)).toBe(true);
    expect(proven.evidence.find((e) => e.kind === 'attestation')?.agentName).toBeNull();
  });

  it('loads five labelled work items, one call each', async () => {
    const steps = await loadAll();
    expect(steps.map((s) => [s.step, s.total, s.existed])).toEqual([1, 2, 3, 4, 5].map((n) => [n, 5, false]));
    const markers = await store.listSampleIssues('10000');
    expect(markers.map((s) => s.slug)).toEqual(SAMPLE_ITEMS.map((i) => i.slug));
    for (const marker of markers) {
      expect(jira.labels.get(marker.issueId)).toEqual([SAMPLE_LABEL]);
      expect(jira.issues.get(marker.issueId)!.issueType).toBe('Story');
    }
    expect((await bySlug('account-lockout')).statusCategory).toBe('done');
    expect((await bySlug('reset-link')).statusCategory).toBe('done');
    expect((await bySlug('audit-export')).statusCategory).toBe('indeterminate');
    expect((await bySlug('idle-timeout')).statusCategory).toBe('new');
  });

  it('leaves the project busy, not climbing, with one unproven close to look at', async () => {
    await loadAll();
    const view = await projects.overview('10000', 7);
    expect(view.sample).toEqual({ loaded: 5, size: 5 });
    expect(view.meter).toMatchObject({ opened: 5, closed: 2, closedProven: 1, closedUnproven: 1, verdict: 'busy' });
    expect(view.rows.map((r) => [r.summary.replace('Sample: ', '').slice(0, 12), r.attention, r.sample])).toEqual([
      ['Fix the brok', 'closed_unproven', true],
      ['Export the a', 'waiting', true],
      ['Upgrade the ', 'open', true],
      ['Lock an acco', 'none', true],
    ]);
    expect(view.contracts).toEqual({ total: 4, listed: 4, proven: 1, closedUnproven: 1, waiting: 1 });
  });

  it('comments on the unproven close as the done gate would, and writes the history', async () => {
    await loadAll();
    const unproven = await bySlug('reset-link');
    expect(jira.comments).toHaveLength(1);
    expect(jira.comments[0]).toMatchObject({ issueId: unproven.id });
    expect(jira.comments[0]!.paragraphs[0]).toBe(
      `${unproven.key} is Done, but it is not proven. 3 of 3 criteria are not proven (2 with no evidence, 1 rejected).`,
    );
    expect(store.eventTypes(unproven.id)).toEqual(['contract.created', 'evidence.submitted', 'issue.done', 'gate.warned']);
    const proven = await bySlug('account-lockout');
    expect(store.eventTypes(proven.id)).toEqual([
      'contract.created',
      'evidence.submitted',
      'evidence.submitted',
      'evidence.submitted',
      'verdict.recorded',
      'verdict.recorded',
      'verdict.recorded',
      'proof.completed',
      'issue.done',
    ]);
    expect(store.events.every((e) => e.channel === 'sample' && e.actorAccountId === null)).toBe(true);
    expect(jira.properties.get(proven.id)).toMatchObject({ state: 'proven', proven: 3, total: 3 });
  });

  it('gives a real person something to do on each sample', async () => {
    await loadAll();
    const waiting = await bySlug('audit-export');
    const view = await contracts.view(waiting.key, BOB);
    const pending = view.criteria.flatMap((c) => c.evidence).filter((e) => e.standing === 'pending');
    expect(pending).toHaveLength(2);
    expect(pending.every((e) => e.canAccept)).toBe(true);
    const after = await contracts.recordVerdict(waiting.key, BOB, { evidenceId: pending[0]!.id, decision: 'accepted' });
    expect(after.summary.proven).toBe(2);

    const todo = await bySlug('idle-timeout');
    const fresh = await contracts.view(todo.key, BOB);
    expect(fresh.exists).toBe(false);
    expect(fresh.suggestions).toHaveLength(3);

    const strict = await bySlug('payment-sdk');
    const refused = await contracts.submitEvidence(strict.key, BOB, {
      criterionId: (await contracts.view(strict.key, BOB)).criteria[0]!.id,
      kind: 'attestation',
      summary: 'I ran the checkout tests and they pass.',
    });
    expect(refused.criteria[0]!.evidence[0]!.standing).toBe('failed_checks');
  });

  it('does not make a second copy when loaded again', async () => {
    await loadAll();
    const again = await loadAll();
    expect(again.every((s) => s.existed)).toBe(true);
    expect((await store.listSampleIssues('10000')).length).toBe(5);
    expect(jira.issues.size).toBe(5);
  });

  it('makes a sample again when someone deleted it in Jira', async () => {
    await loadAll();
    const gone = await bySlug('payment-sdk');
    jira.issues.delete(gone.id);
    const step = await samples.loadOne('10000', 3);
    expect(step.existed).toBe(false);
    expect(step.key).not.toBe(gone.key);
    expect(store.contracts.has(gone.id)).toBe(false);
    expect((await store.listSampleIssues('10000')).length).toBe(5);
  });

  it('removes only what it made, with everything stored about it', async () => {
    jira.add(issueInfo({ id: '1', key: 'MOBL-1', description: doc(h(2, 'Acceptance criteria'), ul('Login works', 'Logout works')) }));
    jira.dates.set('1', { createdAt: NOW, statusCategoryChangedAt: null });
    await contracts.createContract('MOBL-1', ALICE, { withSuggestions: true });
    await loadAll();
    expect(await samples.remove('10000')).toEqual({ removed: 5, kept: [] });
    expect([...jira.issues.keys()]).toEqual(['1']);
    expect([...store.contracts.keys()]).toEqual(['1']);
    expect(store.evidence).toEqual([]);
    expect(store.verdicts).toEqual([]);
    expect(store.events.every((e) => e.issueId === '1')).toBe(true);
    expect(await store.listSampleIssues('10000')).toEqual([]);
    expect((await projects.overview('10000', 7)).sample.loaded).toBe(0);
  });

  it('keeps the record of a sample Jira would not delete', async () => {
    await loadAll();
    jira.failDelete = true;
    const result = await samples.remove('10000');
    expect(result.removed).toBe(0);
    expect(result.kept).toHaveLength(5);
    expect(result.kept[0]).toMatch(/^MOBL-\d+$/);
    expect((await store.listSampleIssues('10000')).length).toBe(5);
  });

  it('stays out of a closed sample when the gate is off', async () => {
    await store.saveSettings('10000', { ...DEFAULT_SETTINGS, gateMode: 'off' });
    await samples.loadOne('10000', 1);
    expect(jira.comments).toEqual([]);
    expect(store.events.map((e) => e.type)).toEqual(['contract.created', 'evidence.submitted', 'issue.done']);
  });

  it('still loads when the workflow will not move the work item', async () => {
    jira.failTransition = true;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const step = await samples.loadOne('10000', 0);
    const issue = jira.issues.get((await store.listSampleIssues('10000'))[0]!.issueId)!;
    expect(issue.statusCategory).toBe('new');
    expect(step.existed).toBe(false);
    expect(store.eventTypes(issue.id)).not.toContain('issue.done');
    expect(warn).toHaveBeenCalledWith(`Proof of Done: could not move sample work item ${issue.id}. Error: Jira returned 400 when moving the work item.`);
    expect((await contracts.view(issue.key, BOB)).summary.state).toBe('proven');
  });

  it('is for project admins, and says so when Jira refuses to create a work item', async () => {
    jira.admin = false;
    await expect(samples.loadOne('10000', 0)).rejects.toMatchObject({ code: 'forbidden' });
    await expect(samples.remove('10000')).rejects.toMatchObject({ code: 'forbidden' });
    jira.admin = true;
    jira.failCreate = 'Jira returned 400 when creating a work item. customfield_10050: Team is required.';
    await expect(samples.loadOne('10000', 0)).rejects.toThrow(
      'Jira would not create a sample work item in Mobile Dev. Jira returned 400 when creating a work item. customfield_10050: Team is required.',
    );
    await expect(samples.loadOne('10000', 9)).rejects.toBeInstanceOf(PodError);
    expect(jira.issues.size).toBe(0);
  });

  it('picks a story or a task, and never an epic when there is a choice', () => {
    const project = (names: string[]) => ({ id: '1', key: 'A', name: 'A', issueTypes: names.map((name, i) => ({ id: String(i), name })) });
    expect(pickIssueType(project(['Epic', 'Bug', 'Task', 'Story']))?.name).toBe('Story');
    expect(pickIssueType(project(['Epic', 'Bug', 'Task']))?.name).toBe('Task');
    expect(pickIssueType(project(['Epic', 'Idea']))?.name).toBe('Idea');
    expect(pickIssueType(project(['Epic']))?.name).toBe('Epic');
    expect(pickIssueType(project([]))).toBeNull();
  });
});
