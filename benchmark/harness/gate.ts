/**
 * One work item under a done contract, held in memory and driven through the
 * repository's own services: the contract is started from the description, evidence
 * goes through `submit-evidence`, the reviewer reads `list-evidence-to-review`, and a
 * verdict goes through `record-verdict`. The gate answer is the one the app gives.
 *
 * The store and the Jira stand-in are the ones the repository's unit tests use.
 */
import { gateDecision, summarize } from '../../src/core/proof';
import { DEFAULT_SETTINGS } from '../../src/core/settings';
import type { AdfNode } from '../../src/core/adf';
import type { Verdict } from '../../src/core/types';
import { AgentService } from '../../src/services/agent';
import type { AgentContract, ReviewQueue } from '../../src/services/agent-view';
import { Caller, ContractService } from '../../src/services/contracts';
import { GraphService } from '../../src/services/graph';
import { ProjectService } from '../../src/services/project';
import { FakeGraph, FakeJira, MemoryStore, issueInfo } from '../../test/helpers/fakes';
import { Task, contractFor } from './lib';
import { WORK_ITEM_KEY } from './prompts';

const NOW = 1_800_000_000_000;
const ISSUE_ID = '1';
/** The coding agent, by its own word. Every agent under test gets the same name, so a reviewer cannot tell them apart. */
const AGENT: Caller = { accountId: 'owner', via: 'agent', agentName: 'coding-agent' };
const VERIFIER: Caller = { accountId: 'owner', via: 'verifier' };

const text = (value: string): AdfNode => ({ type: 'text', text: value });
const paragraph = (value: string): AdfNode => ({ type: 'paragraph', content: [text(value)] });

function descriptionDoc(task: Task): AdfNode {
  const lines = task.description.split('\n').filter((line) => line.trim().length > 0);
  return {
    type: 'doc',
    version: 1,
    content: [
      ...lines.map(paragraph),
      { type: 'heading', attrs: { level: 2 }, content: [text('Acceptance criteria')] },
      {
        type: 'bulletList',
        content: contractFor(task).map((criterion) => ({ type: 'listItem', content: [paragraph(criterion)] })),
      },
    ],
  };
}

/** One piece of evidence as the agent wrote it in proof/evidence.json. */
export type EvidenceInput = Record<string, unknown>;

export interface SubmitOutcome {
  /** Position in the agent's list, from 0. */
  index: number;
  /** `c1`, `c2`, or whatever the agent wrote. */
  criterion: string;
  /** The label the reviewer sees, such as `e1`. Missing when the app refused the piece outright. */
  label: string | null;
  passedChecks: boolean;
  problems: string[];
  /** Set when the app refused to record the piece, for example for an unknown criterion. */
  refused: string | null;
}

export interface GateAnswer {
  pass: boolean;
  reason: string;
  proven: number;
  total: number;
}

export class GateSession {
  private readonly store = new MemoryStore();
  private readonly jira = new FakeJira();
  private readonly agent: AgentService;
  private clock = NOW;
  /** Criterion labels (`c1`) to the app's ids. */
  private criteria = new Map<string, string>();
  /** Reviewer-facing labels (`e1`) to the app's evidence ids. */
  private labels = new Map<string, string>();
  private ids = new Map<string, string>();

  private constructor(task: Task) {
    const now = () => this.clock++;
    this.jira.clock = () => this.clock;
    const contracts = new ContractService(this.store, this.jira, now);
    this.agent = new AgentService(contracts, new ProjectService(this.store, this.jira, now), this.jira, this.store, new GraphService(contracts, new FakeGraph(), 50));
    this.jira.add(
      issueInfo({ id: ISSUE_ID, key: WORK_ITEM_KEY, projectKey: 'BENCH', summary: `Task ${task.id}`, issueType: 'Task', description: descriptionDoc(task) }),
    );
  }

  /** Creates the work item and starts its contract from the acceptance criteria in the description. */
  static async open(task: Task): Promise<GateSession> {
    const session = new GateSession(task);
    const contract = await session.agent.start(WORK_ITEM_KEY, AGENT);
    const expected = contractFor(task);
    if (contract.criteria.length !== expected.length) throw new Error(`The contract has ${contract.criteria.length} criteria, expected ${expected.length}`);
    contract.criteria.forEach((criterion, index) => {
      if (criterion.text !== expected[index]) throw new Error(`Criterion ${index + 1} reads "${criterion.text}"`);
      session.criteria.set(`c${index + 1}`, criterion.id);
    });
    return session;
  }

  /** Sends each piece through `submit-evidence`, in the agent's order. */
  async submit(pieces: EvidenceInput[]): Promise<SubmitOutcome[]> {
    const outcomes: SubmitOutcome[] = [];
    for (const [index, piece] of pieces.entries()) {
      const criterion = String(piece['criterion'] ?? piece['criterionId'] ?? '').trim();
      const base = { index, criterion };
      try {
        const result = await this.agent.submit({ ...piece, criterionId: this.criteria.get(criterion) ?? criterion }, AGENT);
        const label = `e${this.labels.size + 1}`;
        this.labels.set(label, result.evidenceId);
        this.ids.set(result.evidenceId, label);
        outcomes.push({ ...base, label, passedChecks: result.passedChecks, problems: result.problems, refused: null });
      } catch (error) {
        outcomes.push({ ...base, label: null, passedChecks: false, problems: [], refused: error instanceof Error ? error.message : String(error) });
      }
    }
    return outcomes;
  }

  /** What `list-evidence-to-review` returns, with the app's ids replaced by short labels. */
  async queue(): Promise<ReviewQueue> {
    const queue = await this.agent.reviewQueue(WORK_ITEM_KEY, VERIFIER);
    const criterionLabels = new Map([...this.criteria].map(([label, id]) => [id, label]));
    return {
      ...queue,
      waiting: queue.waiting.map((item) => ({
        ...item,
        evidenceId: this.ids.get(item.evidenceId) ?? item.evidenceId,
        criterionId: criterionLabels.get(item.criterionId) ?? item.criterionId,
      })),
    };
  }

  /** Records a verdict through `record-verdict`, as the Proof Verifier. Returns the app's refusal, if any. */
  async verdict(label: string, decision: unknown, reason: unknown): Promise<string | null> {
    try {
      await this.agent.verdict({ issueKey: WORK_ITEM_KEY, evidenceId: this.labels.get(label) ?? label, decision, reason }, VERIFIER);
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  }

  /** The app's answer to "may this work item close?". */
  async gate(): Promise<GateAnswer> {
    const contract: AgentContract = await this.agent.contract(WORK_ITEM_KEY, AGENT);
    return { pass: contract.gate.passes, reason: contract.gate.reason, proven: contract.proof.proven, total: contract.proof.total };
  }

  /**
   * The gate answer when the submitting agent's own verdicts are the only ones, in a
   * project that allows self-review. The app has no tool that lets an agent judge its
   * own evidence, so this cannot go through the services. The core rules compute it:
   * the verdicts are marked as not independent, and `requireIndependent` is off.
   * With the default setting the same verdicts prove nothing.
   */
  async selfReviewGate(verdicts: Array<{ label: string; decision: 'accepted' | 'rejected'; reason: string }>): Promise<{ allowed: GateAnswer; default: GateAnswer }> {
    const bundle = await this.store.getBundle(ISSUE_ID);
    const own: Verdict[] = [];
    for (const [index, verdict] of verdicts.entries()) {
      const evidence = bundle.evidence.find((piece) => piece.id === this.labels.get(verdict.label));
      if (!evidence || !evidence.checksPassed) continue;
      own.push({
        id: `self-${index + 1}`,
        evidenceId: evidence.id,
        criterionId: evidence.criterionId,
        issueId: ISSUE_ID,
        decision: verdict.decision,
        reason: verdict.reason,
        channel: 'ui',
        actorAccountId: AGENT.accountId,
        independent: false,
        createdAt: this.clock++,
      });
    }
    const policy = { gateMode: DEFAULT_SETTINGS.gateMode, enforceWithoutContract: DEFAULT_SETTINGS.enforceWithoutContract };
    const answer = (requireIndependent: boolean): GateAnswer => {
      const summary = summarize(bundle.criteria, bundle.evidence, [...bundle.verdicts, ...own], requireIndependent);
      const decision = gateDecision(summary, policy);
      return { pass: decision.pass, reason: decision.reason, proven: summary.proven, total: summary.total };
    };
    return { allowed: answer(false), default: answer(true) };
  }
}

export interface ParsedVerdict {
  label: string;
  decision: 'accepted' | 'rejected';
  reason: string;
}

/** Reads `{"verdicts": [...]}` out of a reviewer's parsed answer. Entries that are not usable are dropped. */
export function parseVerdicts(answer: unknown): ParsedVerdict[] | null {
  if (!answer || typeof answer !== 'object') return null;
  const list = (answer as Record<string, unknown>)['verdicts'];
  if (!Array.isArray(list)) return null;
  const verdicts: ParsedVerdict[] = [];
  for (const entry of list) {
    if (!entry || typeof entry !== 'object') continue;
    const row = entry as Record<string, unknown>;
    const decision = String(row['decision'] ?? '').trim().toLowerCase();
    if (decision !== 'accepted' && decision !== 'rejected') continue;
    verdicts.push({ label: String(row['evidenceId'] ?? '').trim(), decision, reason: String(row['reason'] ?? '').trim() });
  }
  return verdicts;
}

/**
 * The app's gate answer for one run after one reviewer's verdicts: a fresh work item,
 * the agent's evidence through submit-evidence, each verdict through record-verdict.
 */
export async function gateAfterReview(
  task: Task,
  evidence: EvidenceInput[],
  verdicts: ParsedVerdict[] | null,
): Promise<{ gate: GateAnswer; refusals: Array<{ label: string; error: string }> }> {
  const session = await GateSession.open(task);
  await session.submit(evidence);
  const refusals: Array<{ label: string; error: string }> = [];
  for (const verdict of verdicts ?? []) {
    const error = await session.verdict(verdict.label, verdict.decision, verdict.reason);
    if (error) refusals.push({ label: verdict.label, error });
  }
  return { gate: await session.gate(), refusals };
}

/** The gate answer for one run from the agent's own verdicts. See `GateSession.selfReviewGate`. */
export async function gateAfterSelfReview(task: Task, evidence: EvidenceInput[], verdicts: ParsedVerdict[] | null): Promise<{ allowed: GateAnswer; default: GateAnswer }> {
  const session = await GateSession.open(task);
  await session.submit(evidence);
  return session.selfReviewGate(verdicts ?? []);
}
