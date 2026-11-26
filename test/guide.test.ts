import { beforeEach, describe, expect, it } from 'vitest';
import { GUIDE_AGENT, GUIDE_SLUG, GUIDE_STEPS, GUIDE_WORKFLOW, SAMPLE_LABEL } from '../src/core/sample';
import { DEFAULT_SETTINGS } from '../src/core/settings';
import { ContractService } from '../src/services/contracts';
import { GuideService } from '../src/services/guide';
import { ProjectService } from '../src/services/project';
import { GuideView } from '../src/services/project-view';
import { ReceiptService } from '../src/services/receipts';
import { SampleService } from '../src/services/sample';
import { FakeJira, MemoryStore, issueInfo } from './helpers/fakes';

let store: MemoryStore;
let jira: FakeJira;
let guide: GuideService;
let clock: number;

beforeEach(() => {
  store = new MemoryStore();
  jira = new FakeJira();
  clock = 1_800_000_000_000;
  jira.clock = () => clock;
  guide = new GuideService(store, jira, () => clock++);
});

/** Presses through the run up to and including the named step. */
async function runTo(last: string): Promise<GuideView> {
  let view = await guide.state('10000');
  while (view.next) {
    const id = view.next.id;
    view = await guide.advance('10000', 'alice', id);
    if (id === last) break;
  }
  return view;
}

const guideIssue = async () => (await store.listSampleIssues('10000')).find((s) => s.slug === GUIDE_SLUG)!.issueId;
const panel = async () => new ContractService(store, jira, () => clock++).view(await guideIssue(), { accountId: 'alice', via: 'ui' });

describe('the guided run', () => {
  it('offers the first step before anything exists, and makes nothing by being looked at', async () => {
    expect(await guide.state('10000')).toEqual({ key: null, lines: [], next: { id: 'start', label: 'Start the one-minute run' }, total: 6 });
    expect(jira.issues.size).toBe(0);
  });

  it('starts with a real work item, marked as a sample, and a contract read from its description', async () => {
    const view = await runTo('start');
    const issue = jira.issues.get(await guideIssue())!;
    expect(issue.summary).toBe('Sample: Apply a discount code at checkout');
    expect(jira.labels.get(issue.id)).toEqual([SAMPLE_LABEL]);
    expect(view.key).toBe(issue.key);
    expect(view.lines).toEqual([
      {
        id: 'start',
        text: `The app made ${issue.key} with a done contract of one criterion: "All checkout tests pass".`,
        pass: false,
        reason: 'The one criterion has no evidence.',
      },
    ]);
    expect(view.next).toEqual({ id: 'claim', label: 'The agent says it is done' });
    const contract = await panel();
    expect(contract.criteria).toHaveLength(1);
    // It takes any evidence. Its wording is what makes it the pipeline's to prove.
    expect(contract.criteria[0]).toMatchObject({ text: 'All checkout tests pass', source: 'description', requiredKind: 'any' });
  });

  it('tells the story: a claim, a contradiction, a fix, a new commit, and proof of it', async () => {
    const view = await runTo('passes_again');
    expect(view.next).toBeNull();
    expect(view.lines.map((line) => [line.id, line.pass, line.reason])).toEqual([
      ['start', false, 'The one criterion has no evidence.'],
      ['claim', false, 'The evidence for the one criterion waits for a check.'],
      ['pipeline_fails', false, 'The evidence for the one criterion was turned away.'],
      ['fix_passes', true, 'The one criterion is proven.'],
      ['new_commit', false, 'The proof of the one criterion is about an earlier commit.'],
      ['passes_again', true, 'The one criterion is proven.'],
    ]);
  });

  it('gets every answer from the records, so the panel of the work item agrees with it', async () => {
    await runTo('pipeline_fails');
    const contract = await panel();
    const [fromPipeline, fromAgent] = contract.criteria[0]!.evidence;
    expect(fromAgent).toMatchObject({ channel: 'agent', agentName: GUIDE_AGENT, standing: 'rejected', verdict: { channel: 'check' } });
    expect(fromAgent!.verdict!.reason).toContain("The project's pipeline reported on the same commit (a1f3c9e)");
    expect(fromPipeline).toMatchObject({ channel: 'ci', standing: 'failed_checks' });
    expect(contract.gate).toEqual({ pass: false, reason: 'The evidence for the one criterion was turned away.' });
  });

  it('labels every simulated record as sample data', async () => {
    await runTo('passes_again');
    const issueId = await guideIssue();
    const evidence = store.evidence.filter((e) => e.issueId === issueId);
    expect(evidence).toHaveLength(5);
    for (const item of evidence) {
      expect(item.summary).toMatch(/^Sample /);
      if (item.channel === 'ci') expect(item.details.workflow).toBe(GUIDE_WORKFLOW);
      else expect(item.agentName).toBe(GUIDE_AGENT);
      expect(item.url).toBeNull();
    }
    expect(store.events.filter((e) => e.type === 'sample.step').map((e) => e.channel)).toEqual(Array(6).fill('sample'));
  });

  it('follows the rules of the project it runs in', async () => {
    await store.saveSettings('10000', { ...DEFAULT_SETTINGS, pipelineProves: false });
    const view = await runTo('fix_passes');
    expect(view.lines.at(-1)).toMatchObject({ pass: false, reason: 'The evidence for the one criterion waits for a check.' });
  });

  it('runs each step once, in order, for someone who administers the project', async () => {
    await runTo('claim');
    await expect(guide.advance('10000', 'alice', 'claim')).rejects.toThrow('The guided run has moved on.');
    await expect(guide.advance('10000', 'alice', 'passes_again')).rejects.toThrow('The guided run has moved on.');
    jira.admin = false;
    await expect(guide.advance('10000', 'alice', 'pipeline_fails')).rejects.toThrow('You need to administer');
    jira.admin = true;
    await runTo('passes_again');
    await expect(guide.advance('10000', 'alice', 'start')).rejects.toThrow('The guided run is over.');
    expect(GUIDE_STEPS).toHaveLength(6);
  });

  it('goes away with the sample data, and can be run again', async () => {
    await runTo('passes_again');
    const samples = new SampleService(store, jira, () => clock++);
    expect(await samples.remove('10000')).toEqual({ removed: 1, kept: [] });
    expect(jira.issues.size).toBe(0);
    expect(store.evidence).toEqual([]);
    expect(store.events.filter((e) => e.type === 'sample.step')).toEqual([]);
    expect(await guide.state('10000')).toMatchObject({ key: null, lines: [] });
    expect((await runTo('start')).lines).toHaveLength(1);
  });

  it('starts again when someone deleted its work item in Jira', async () => {
    await runTo('claim');
    jira.issues.delete(await guideIssue());
    expect(await guide.state('10000')).toMatchObject({ key: null, lines: [], next: { id: 'start' } });
    expect(await store.listSampleIssues('10000')).toEqual([]);
  });

  it('does not count as one of the five samples on the project page', async () => {
    await runTo('claim');
    const page = await new ProjectService(store, jira, () => clock++).overview('10000', 7);
    expect(page.sample).toEqual({ loaded: 0, size: 5 });
    expect(page.rows).toHaveLength(1);
    expect(page.rows[0]).toMatchObject({ sample: true, summary: 'Sample: Apply a discount code at checkout' });
  });
});

describe('a simulated pipeline result', () => {
  it('is taken on a sample work item only', async () => {
    const receipts = new ReceiptService(store, jira, () => clock++);
    const real = jira.add(issueInfo());
    await new ContractService(store, jira, () => clock++).createContract(real.key, { accountId: 'alice', via: 'ui' }, { withSuggestions: false });
    const body = JSON.stringify({ issue: real.key, commit: 'a'.repeat(40), passed: 3, failed: 0 });
    await expect(receipts.acceptSample(real, body)).rejects.toThrow('Only a sample work item takes a simulated pipeline result.');
    expect(store.evidence).toEqual([]);
  });
});
