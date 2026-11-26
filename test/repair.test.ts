import { beforeEach, describe, expect, it } from 'vitest';
import { MCP_TOOLS, runTool } from '../src/actions/tools';
import { GUIDE_SLUG } from '../src/core/sample';
import { AgentService } from '../src/services/agent';
import { Caller, ContractService } from '../src/services/contracts';
import { GraphService } from '../src/services/graph';
import { GuideService } from '../src/services/guide';
import { ProjectService } from '../src/services/project';
import { BRIEF_MAX, cleanBrief, currentBrief } from '../src/services/repair';
import { FakeGraph, FakeJira, MemoryStore } from './helpers/fakes';

const AGENT: Caller = { accountId: 'alice', via: 'agent', agentName: 'claude-code' };
const ALICE: Caller = { accountId: 'alice', via: 'ui' };
const VERIFIER: Caller = { accountId: 'alice', via: 'verifier' };
const BRIEF =
  'All checkout tests pass: the pipeline ran commit a1f3c9e and 2 tests failed. Fix the two failing tests, push, and wait for the pipeline to report.';

let store: MemoryStore;
let jira: FakeJira;
let graph: FakeGraph;
let contracts: ContractService;
let agent: AgentService;
let guide: GuideService;
let clock: number;
let key: string;

/** Presses through the guided run up to and including the named step. Its work item is the one under test. */
async function runTo(last: string): Promise<void> {
  let view = await guide.state('10000');
  while (view.next) {
    const id = view.next.id;
    view = await guide.advance('10000', 'alice', id);
    if (id === last) break;
  }
  const issueId = (await store.listSampleIssues('10000')).find((s) => s.slug === GUIDE_SLUG)!.issueId;
  key = jira.issues.get(issueId)!.key;
}

beforeEach(() => {
  store = new MemoryStore();
  jira = new FakeJira();
  graph = new FakeGraph();
  clock = 1_800_000_000_000;
  const now = () => clock++;
  jira.clock = () => clock;
  contracts = new ContractService(store, jira, now);
  agent = new AgentService(contracts, new ProjectService(store, jira, now), jira, store, new GraphService(contracts, graph, 50));
  guide = new GuideService(store, jira, now);
});

describe('what blocks a work item', () => {
  it('sets the agent\'s claim against what the pipeline reported on the same commit', async () => {
    await runTo('pipeline_fails');
    const blockers = await agent.blockers(key, VERIFIER);
    expect(blockers.proof).toEqual({ state: 'unproven', proven: 0, total: 1 });
    expect(blockers.gate.passes).toBe(false);
    expect(blockers.commit).toBe('a1f3c9e07b2d4c58916e0fa3d7b84c21e5f6a903');
    expect(blockers.blocking).toHaveLength(1);
    const [criterion] = blockers.blocking;
    expect(criterion).toMatchObject({ text: 'All checkout tests pass', state: 'rejected' });
    expect(criterion!.conflicts).toHaveLength(1);
    expect(criterion!.conflicts![0]).toMatch(/^The agent .+ said about commit a1f3c9e07b2d: "Sample /);
    expect(criterion!.conflicts![0]).toContain("The project's pipeline reported on the same commit (a1f3c9e), and its result does not pass:");
    expect(blockers.rules.join(' ')).toContain('A brief proves nothing and records no verdict.');
    expect(blockers.next).toBe(
      'Explain what blocks this work item, criterion by criterion. Then call write-repair-brief once, with what the coding agent has to fix.',
    );
    expect(blockers.repairBrief).toBeUndefined();
    expect(blockers.closedWithoutProof).toBeUndefined();
  });

  it('says so when proof is about a commit the pipeline has moved past', async () => {
    await runTo('new_commit');
    const [criterion] = (await agent.blockers(key, VERIFIER)).blocking;
    expect(criterion!.conflicts).toContain(
      'The proof on record is about commit b72d04a9c1e3. The pipeline has since reported commit c9e51b3f8a06, so that proof no longer counts.',
    );
  });

  it('has nothing to explain where nothing blocks, and no conflict where evidence is only missing', async () => {
    await runTo('start');
    const open = await agent.blockers(key, VERIFIER);
    expect(open.blocking).toHaveLength(1);
    expect(open.blocking[0]!.conflicts).toBeUndefined();
    expect(graph.asked).toEqual([]);

    await runTo('fix_passes');
    const proven = await agent.blockers(key, VERIFIER);
    expect(proven.blocking).toEqual([]);
    expect(proven.next).toBe('Every criterion is proven. Nothing blocks this work item, and there is nothing to repair.');
  });

  it('marks work that was closed while its contract is open', async () => {
    await runTo('pipeline_fails');
    const issue = [...jira.issues.values()].find((candidate) => candidate.key === key)!;
    issue.statusCategory = 'done';
    expect((await agent.blockers(key, VERIFIER)).closedWithoutProof).toBe(true);
  });
});

describe('the repair brief', () => {
  it('reaches the coding agent with the contract and the context pack', async () => {
    await runTo('pipeline_fails');
    const saved = await agent.writeBrief({ issueKey: key, brief: `  ${BRIEF}\r\n\r\n\r\n` }, VERIFIER);
    expect(saved.repairBrief).toMatchObject({ text: BRIEF, writtenBy: 'the Proof Verifier', commit: 'a1f3c9e07b2d4c58916e0fa3d7b84c21e5f6a903' });
    expect(saved.repairBrief.note).toContain('It is advice. It proves nothing and changes no rule');
    expect(saved.next).toContain('It replaces the brief before it.');
    // The brief changed nothing about the proof.
    expect(saved.proof).toEqual({ state: 'unproven', proven: 0, total: 1 });

    const contract = await agent.contract(key, AGENT);
    expect(contract.repairBrief?.text).toBe(BRIEF);
    expect(contract.next).toMatch(/^Read `repairBrief` first: it says what to fix\. /);
    expect((await agent.contextPack(key, AGENT)).contract.repairBrief?.text).toBe(BRIEF);
    expect((await agent.blockers(key, VERIFIER)).repairBrief?.text).toBe(BRIEF);
    expect((await contracts.view(key, ALICE)).brief).toMatchObject({ text: BRIEF, askedBy: 'alice', outdated: false });
  });

  it('goes away once the work is proven, and comes back marked when the pipeline has moved on', async () => {
    await runTo('pipeline_fails');
    await agent.writeBrief({ issueKey: key, brief: BRIEF }, VERIFIER);

    await runTo('fix_passes');
    expect((await agent.contract(key, AGENT)).repairBrief).toBeUndefined();
    expect((await contracts.view(key, ALICE)).brief).toBeNull();
    await expect(agent.writeBrief({ issueKey: key, brief: BRIEF }, VERIFIER)).rejects.toMatchObject({
      code: 'invalid',
      message: `Every criterion of ${key} is proven, so there is nothing to repair.`,
    });

    await runTo('new_commit');
    const contract = await agent.contract(key, AGENT);
    expect(contract.repairBrief?.note).toContain('The pipeline has reported commit c9e51b3f8a06 since it was written, so check that it still applies.');
    expect((await contracts.view(key, ALICE)).brief?.outdated).toBe(true);
  });

  it('is replaced by a newer one, and a person can remove it', async () => {
    await runTo('pipeline_fails');
    await agent.writeBrief({ issueKey: key, brief: BRIEF }, VERIFIER);
    const second = `${BRIEF} Name the commit in the evidence.`;
    await agent.writeBrief({ issueKey: key, brief: second }, VERIFIER);
    expect((await agent.contract(key, AGENT)).repairBrief?.text).toBe(second);

    await expect(contracts.removeBrief(key, AGENT)).rejects.toMatchObject({ code: 'forbidden' });
    await expect(contracts.removeBrief(key, VERIFIER)).rejects.toMatchObject({ code: 'forbidden' });
    expect((await contracts.removeBrief(key, ALICE)).brief).toBeNull();
    expect((await agent.contract(key, AGENT)).repairBrief).toBeUndefined();
    await expect(contracts.removeBrief(key, ALICE)).rejects.toMatchObject({ code: 'conflict', message: 'This work item has no repair brief.' });
    // Every brief and its removal stay in the history.
    expect(store.events.filter((event) => event.type.startsWith('brief.')).map((event) => [event.type, event.channel])).toEqual([
      ['brief.written', 'verifier'],
      ['brief.written', 'verifier'],
      ['brief.removed', 'ui'],
    ]);
  });

  it('is written by the Proof Verifier alone, and never through the tools an outside agent has', async () => {
    await runTo('pipeline_fails');
    await expect(contracts.writeBrief(key, AGENT, BRIEF)).rejects.toMatchObject({ code: 'forbidden', message: 'Only the Proof Verifier writes a repair brief.' });
    await expect(contracts.writeBrief(key, ALICE, BRIEF)).rejects.toMatchObject({ code: 'forbidden' });
    expect(MCP_TOOLS).not.toContain('write-repair-brief');
    expect(MCP_TOOLS).not.toContain('list-proof-blockers');

    const context = { principal: { accountId: 'alice' } };
    const result = await runTool(agent, 'write-repair-brief', { issueKey: key, brief: BRIEF }, context);
    expect(result).toMatchObject({ ok: true, repairBrief: { text: BRIEF } });
    expect(store.verdicts.filter((verdict) => verdict.channel === 'verifier')).toEqual([]);

    jira.editable = false;
    expect(await runTool(agent, 'write-repair-brief', { issueKey: key, brief: BRIEF }, context)).toMatchObject({ ok: false, code: 'forbidden' });
  });

  it('needs a contract with something open, and a brief of a sensible length', async () => {
    await runTo('pipeline_fails');
    await expect(agent.writeBrief({ issueKey: key, brief: 'Fix it.' }, VERIFIER)).rejects.toMatchObject({ code: 'invalid' });
    await expect(agent.writeBrief({ issueKey: key }, VERIFIER)).rejects.toMatchObject({ code: 'invalid' });
    await expect(agent.writeBrief({ issueKey: key, brief: 'x'.repeat(BRIEF_MAX + 1) }, VERIFIER)).rejects.toMatchObject({
      code: 'invalid',
      message: 'A repair brief has at most 2,000 characters. This one has 2001. Shorten it.',
    });
    expect(cleanBrief(`First line.   \n\n\n\nSecond line, with a bell\u0007 in it, to be long enough.`)).toBe(
      'First line.\n\nSecond line, with a bell in it, to be long enough.',
    );
    expect(currentBrief([])).toBeNull();
  });
});
