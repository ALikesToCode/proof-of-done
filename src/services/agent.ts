import { adfText } from '../core/adf';
import { PodError } from '../core/errors';
import { LinkedItem, LinkedWork, compareWithGraph, graphCovers } from '../core/graph';
import { awaitsReview } from '../core/proof';
import { CriterionState, EvidenceChannel, EvidenceKind, EvidenceStanding, RequiredKind, VerdictChannel } from '../core/types';
import { JiraGateway } from '../jira/gateway';
import { ContractStore } from '../store/types';
import {
  AgentContract,
  AgentCriterion,
  AgentCriterionState,
  AgentEvidence,
  AgentGate,
  AgentLinkedItem,
  AgentProof,
  AgentStanding,
  AgentWorkItem,
  ContextPack,
  ReviewItem,
  ReviewQueue,
  SubmitResult,
  UnprovenWork,
  VerdictResult,
} from './agent-view';
import { Caller, ContractService } from './contracts';
import { ProjectService } from './project';
import { WorkItemRow } from './project-view';
import { ContractView, CriterionView, EvidenceView } from './view';

/**
 * What the agent tools do. Every rule lives in ContractService and ProjectService.
 * This class only turns their answers into something a language model can act on,
 * and forgives the small slips a model makes when it fills in a tool call.
 */

const EVIDENCE_SHOWN = 5;
const DESCRIPTION_LIMIT = 12_000;
const PARENT_LIMIT = 2_000;
const COMMENT_LIMIT = 1_500;
const REVIEW_DESCRIPTION_LIMIT = 6_000;
const WORK_LISTED = 30;
const PROJECT_REF = /^(?:\d{1,18}|[A-Za-z][A-Za-z0-9_]{0,63})$/;

const asText = (value: unknown): string => (typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '');
const count = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

const KIND_ALIASES: Record<string, EvidenceKind> = {
  test: 'test_run',
  tests: 'test_run',
  testrun: 'test_run',
  test_results: 'test_run',
  ci: 'build',
  pipeline: 'build',
  pr: 'pull_request',
  pullrequest: 'pull_request',
  merge_request: 'pull_request',
  doc: 'document',
  docs: 'document',
  page: 'document',
};

/** A model writes "Test run" or "pull-request" as often as the exact id. */
export function toKind(raw: unknown): string {
  const key = asText(raw)
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  return KIND_ALIASES[key] ?? key;
}

export function toDecisionWord(raw: unknown): string {
  const word = asText(raw).trim().toLowerCase();
  if (word === 'accept' || word === 'approve' || word === 'approved') return 'accepted';
  if (word === 'reject' || word === 'decline' || word === 'declined') return 'rejected';
  return word;
}

const SUBMITTER: Record<EvidenceChannel, string> = {
  ui: 'a person',
  agent: 'an agent',
  ci: 'a pipeline',
  graph: 'Teamwork Graph',
  sample: 'the sample data',
};

const DECIDER: Record<VerdictChannel, string> = {
  ui: 'a person',
  verifier: 'the Proof Verifier',
  attestation: 'the attestation itself',
  check: 'the automatic checks',
  ci: "the project's pipeline",
  sample: 'the sample data',
};

const STANDING: Record<EvidenceStanding, AgentStanding> = {
  failed_checks: 'failed_checks',
  stale: 'stale_commit',
  pending: 'waiting_for_review',
  accepted: 'accepted',
  self_accepted: 'accepted_by_submitter',
  rejected: 'rejected',
};

const CRITERION_STATE: Record<CriterionState, AgentCriterionState> = {
  unproven: 'no_evidence',
  submitted: 'waiting_for_review',
  proven: 'proven',
  rejected: 'rejected',
};

/** One line per criterion, kept short because a contract can repeat it forty times. */
const HOW_TO_PROVE: Record<RequiredKind, string> = {
  any: 'Submit evidence.',
  test_run: 'Submit a test run with the numbers of passed and failed tests.',
  build: 'Submit a build with its result, and a link or a commit.',
  pull_request: 'Submit a pull request with its link and its state.',
  document: 'Submit a document with its link.',
  attestation: 'Only a person can prove this one. Ask a person to add their attestation in the Proof of Done panel.',
  other: 'Submit a link, or the excerpt that shows it.',
};

/** Added to the review rules when the graph has something to say about an entry. */
const GRAPH_RULE =
  "A `graph` line says what Jira's Teamwork Graph holds about the pull request or build behind an entry. Jira got it from the tool itself, so trust it over what the evidence says about itself. Where it says the two differ, reject unless the evidence explains the difference. Where it says the link is not among the ones Jira links to the work item, the link alone proves nothing.";

/** What an agent can do when Jira does not link its pull request or build to the work item. */
const HOW_JIRA_LINKS = 'Jira links a pull request or a build to a work item when the work item key is in the branch name, the pull request title or a commit message.';

const REVIEW_RULES = [
  'Judge each piece of evidence against its own criterion. The question is whether it shows the criterion is met.',
  'Go by what the evidence states: its summary, numbers, command, commit, status and excerpt. A link you cannot open proves nothing by being there.',
  'Reject evidence that is about something else, that is too vague to check, or that only says the work was done.',
  'When in doubt, reject and say what would convince you. A rejection costs one more submission. A wrong acceptance closes work that is not done.',
  'Give your reasoning in one or two sentences. It is stored with the verdict and the team reads it.',
];

function failedChecks(evidence: EvidenceView): string[] {
  return evidence.checks.filter((check) => !check.ok).map((check) => check.note);
}

export function toAgentEvidence(evidence: EvidenceView): AgentEvidence {
  const problems = failedChecks(evidence);
  return {
    id: evidence.id,
    kind: evidence.kind,
    summary: evidence.summary,
    ...(evidence.url ? { url: evidence.url } : {}),
    ...(Object.keys(evidence.details).length > 0 ? { details: evidence.details } : {}),
    submittedBy: evidence.channel === 'agent' && evidence.agentName ? `the agent ${evidence.agentName}` : SUBMITTER[evidence.channel],
    submittedAt: new Date(evidence.createdAt).toISOString(),
    standing: STANDING[evidence.standing],
    ...(problems.length > 0 ? { problems } : {}),
    ...(evidence.verdict
      ? { verdict: { decision: evidence.verdict.decision, reason: evidence.verdict.reason, by: DECIDER[evidence.verdict.channel] } }
      : {}),
  };
}

/** Why the newest evidence of a criterion does not stand. */
function whyTurnedAway(evidence: EvidenceView | undefined): string {
  if (!evidence) return '';
  if (evidence.standing === 'failed_checks') return `The last one failed the automatic checks. ${failedChecks(evidence).join(' ')}`.trim();
  if (evidence.standing === 'rejected' && evidence.verdict) return `The last one was rejected. ${evidence.verdict.reason}`.trim();
  return '';
}

function nextStep(criterion: CriterionView): string {
  switch (criterion.state) {
    case 'proven':
      return 'Nothing. This criterion is proven.';
    case 'submitted':
      return criterion.needsIndependent
        ? 'Wait. The person who entered the evidence accepted it, and this project needs someone else to.'
        : 'Wait. The evidence is in and needs a review by a person or the Proof Verifier. You cannot accept it yourself.';
    case 'rejected':
      return `Submit new evidence. ${whyTurnedAway(criterion.evidence[0])}`.trim();
    default:
      return HOW_TO_PROVE[criterion.requiredKind];
  }
}

export function toAgentCriterion(criterion: CriterionView): AgentCriterion {
  return {
    id: criterion.id,
    text: criterion.text,
    needs: criterion.requiredKind,
    state: CRITERION_STATE[criterion.state],
    next: nextStep(criterion),
    evidence: criterion.evidence.slice(0, EVIDENCE_SHOWN).map(toAgentEvidence),
    ...(criterion.evidence.length > EVIDENCE_SHOWN ? { evidenceTotal: criterion.evidence.length } : {}),
  };
}

function toWorkItem(issue: { key: string; summary: string; issueType: string; statusName: string; statusCategory: string }): AgentWorkItem {
  return { key: issue.key, summary: issue.summary, type: issue.issueType, status: issue.statusName, done: issue.statusCategory === 'done' };
}

const toProof = (view: ContractView): AgentProof => ({ state: view.summary.state, proven: view.summary.proven, total: view.summary.total });
const toGate = (view: ContractView): AgentGate => ({ passes: view.gate.pass, mode: view.policy.gateMode, reason: view.gate.reason });

function overallNext(view: ContractView): string {
  if (!view.exists) {
    return view.suggestions.length > 0
      ? `This work item has no done contract yet. Call start-done-contract to create it from the ${count(view.suggestions.length, 'criterion', 'criteria')} found in its description and the project rules.`
      : 'This work item has no done contract, and no acceptance criteria were found in its description. Ask a person to write the contract in the Proof of Done panel.';
  }
  const summary = view.summary;
  if (summary.total === 0) return 'The contract has no criteria yet. Ask a person to add them in the Proof of Done panel.';
  if (summary.state === 'proven') {
    return `${summary.total === 1 ? 'The one criterion is proven.' : `All ${summary.total} criteria are proven.`} The work item can be closed.`;
  }
  const parts: string[] = [];
  const open = summary.unproven + summary.rejected;
  if (open > 0) {
    parts.push(
      `${count(open, 'criterion still needs', 'criteria still need')} evidence. Call submit-evidence once for each, with a test run, a build, a pull request, a document, or other evidence that has a link or an excerpt.`,
    );
  }
  if (summary.submitted > 0) {
    parts.push(`${count(summary.submitted, 'criterion waits', 'criteria wait')} for a review by a person or the Proof Verifier.`);
  }
  if (view.policy.gateMode !== 'off') parts.push('Do not move the work item to a done status before every criterion is proven.');
  return parts.join(' ');
}

export function toAgentContract(view: ContractView): AgentContract {
  const suggested = view.exists
    ? []
    : view.suggestions.map((s) => ({ text: s.text, needs: s.requiredKind, from: s.source === 'project_rule' ? 'a project rule' : 'the description' }));
  return {
    workItem: toWorkItem(view.issue),
    hasContract: view.exists,
    proof: toProof(view),
    gate: toGate(view),
    criteria: view.criteria.map(toAgentCriterion),
    ...(suggested.length > 0 ? { suggested } : {}),
    next: overallNext(view),
  };
}

function proofRules(policy: ContractView['policy']): string[] {
  const rules = [
    'Prove each criterion with evidence. Call submit-evidence once per criterion, with the criterion id from the contract.',
    'The app checks evidence the moment it arrives. A test run with failed tests, a build that did not pass, or a pull request link that is not a pull request is turned away, and the answer says why.',
    'Evidence that passes the checks waits for a review. A person or the Proof Verifier accepts or rejects it. You cannot accept evidence yourself.',
    'Only a person can attest. Do not submit an attestation.',
    'You cannot add, change or remove criteria. If a criterion is wrong or cannot be met, tell the person who gave you the work.',
    `When you submit a pull request or a build, the reviewer sees whether Jira's Teamwork Graph links it to the work item. ${HOW_JIRA_LINKS}`,
  ];
  if (policy.gateMode === 'warn') {
    rules.push('Do not move the work item to a done status before every criterion is proven. The done gate comments on work that is closed without proof.');
  }
  if (policy.gateMode === 'bounce') {
    rules.push('Do not move the work item to a done status before every criterion is proven. The done gate moves it back.');
  }
  return rules;
}

/** An excerpt may open with the command that produced it, written as "$ npm test". */
export function splitExcerpt(excerpt: string): { command: string; text: string } {
  const match = /^\s*\$ +([^\n]+)\n?/.exec(excerpt);
  if (!match) return { command: '', text: excerpt };
  return { command: (match[1] ?? '').trim(), text: excerpt.slice(match[0].length) };
}

export function toAgentLinked(item: LinkedItem): AgentLinkedItem {
  return {
    kind: item.kind,
    name: item.name,
    ...(item.url ? { url: item.url } : {}),
    ...(item.state ? { state: item.state.replace(/_/g, ' ') } : {}),
    ...(item.environment ? { environment: item.environment } : {}),
    ...(item.provider ? { provider: item.provider } : {}),
    ...(item.updatedAt ? { updatedAt: item.updatedAt } : {}),
  };
}

/** Where the agent tools read the Teamwork Graph. Null means the graph gave no answer. */
export interface GraphLookup {
  linked(issueId: string): Promise<LinkedWork | null>;
}

function clip(text: string, limit: number): { text: string; cut: boolean } {
  return text.length > limit ? { text: `${text.slice(0, limit).trimEnd()} …`, cut: true } : { text, cut: false };
}

function workNote(row: WorkItemRow): string {
  if (row.total === 0) return 'The contract has no criteria yet.';
  const parts: string[] = [];
  if (row.attention === 'closed_unproven') parts.push('Closed without proof.');
  const idle = row.total - row.proven - row.waiting - row.rejected;
  if (row.rejected > 0) parts.push(`${count(row.rejected, 'criterion has', 'criteria have')} only evidence that was turned away.`);
  if (idle > 0) parts.push(`${count(idle, 'criterion has', 'criteria have')} no evidence.`);
  if (row.waiting > 0) parts.push(`${count(row.waiting, 'criterion waits', 'criteria wait')} for a review.`);
  return parts.join(' ');
}

export class AgentService {
  constructor(
    private readonly contracts: ContractService,
    private readonly projects: ProjectService,
    private readonly jira: JiraGateway,
    private readonly store: ContractStore,
    private readonly graph: GraphLookup,
  ) {}

  /** The contract of a work item and where its proof stands. */
  async contract(issueKey: unknown, caller: Caller): Promise<AgentContract> {
    return toAgentContract(await this.contracts.view(asText(issueKey), caller));
  }

  /**
   * Starts the contract from the criteria in the description and the project rules.
   * Calling it again is harmless: the contract that is already there comes back.
   */
  async start(issueKey: unknown, caller: Caller): Promise<AgentContract> {
    const current = await this.contracts.view(asText(issueKey), caller);
    if (current.exists) return toAgentContract(current);
    return toAgentContract(await this.contracts.createContract(current.issue.key, caller, { withSuggestions: true }));
  }

  /**
   * Records evidence for one criterion. The criterion id alone says which work item
   * it is for. Jira still decides, as the caller, whether they may touch that work item.
   */
  async submit(input: Record<string, unknown>, caller: Caller): Promise<SubmitResult> {
    const unknown = new PodError('not_found', 'No criterion you can see has that id. Call get-done-contract for the ids of the criteria.');
    const criterionId = asText(input['criterionId']).trim();
    const issueId = criterionId && criterionId.length <= 64 ? await this.store.findCriterionIssue(criterionId) : null;
    if (!issueId) throw unknown;
    const { command, text } = splitExcerpt(asText(input['excerpt']));
    const { view, evidenceId } = await this.contracts
      .addEvidence(issueId, caller, {
        criterionId,
        kind: toKind(input['kind']),
        summary: asText(input['summary']),
        url: asText(input['url']).trim() || null,
        details: {
          passed: input['passed'],
          failed: input['failed'],
          skipped: input['skipped'],
          exitCode: input['exitCode'],
          command: asText(input['command']) || command,
          commit: input['commit'],
          status: input['status'],
          text,
        },
      })
      .catch((error: unknown) => {
        // Same answer for a criterion that is not there and one on a work item the caller may not see.
        throw error instanceof PodError && error.code === 'not_found' ? unknown : error;
      });
    const criterion = view.criteria.find((c) => c.evidence.some((e) => e.id === evidenceId));
    const evidence = criterion?.evidence.find((e) => e.id === evidenceId);
    if (!criterion || !evidence) throw new Error('The evidence was recorded but could not be read back.');
    const passedChecks = evidence.standing !== 'failed_checks';
    const open = view.summary.unproven + view.summary.rejected;
    // The reviewer will see what the graph holds about this link, so the agent hears it first.
    const linked = passedChecks && graphCovers(evidence) ? await this.graph.linked(view.issue.id) : null;
    const note = linked ? compareWithGraph(evidence, linked) : null;
    const next = passedChecks
      ? [
          'Recorded. It passed the automatic checks and now waits for a review by a person or the Proof Verifier. You cannot accept it yourself.',
          note?.finding === 'not_linked' ? HOW_JIRA_LINKS : '',
          open > 0 ? `${count(open, 'criterion still needs', 'criteria still need')} evidence.` : '',
        ]
          .filter(Boolean)
          .join(' ')
      : 'Recorded, and turned away by the automatic checks. Fix what the problems say and submit again.';
    return {
      evidenceId,
      passedChecks,
      problems: failedChecks(evidence),
      ...(note ? { graph: note.text } : {}),
      criterion: toAgentCriterion(criterion),
      proof: toProof(view),
      gate: toGate(view),
      next,
    };
  }

  /** Everything an agent should read before it starts on a work item. */
  async contextPack(issueKey: unknown, caller: Caller): Promise<ContextPack> {
    const view = await this.contracts.view(asText(issueKey), caller);
    const [issue, context, linked] = await Promise.all([
      this.jira.getIssue(view.issue.id, 'user'),
      this.jira.getIssueContext(view.issue.id, 'user'),
      this.graph.linked(view.issue.id),
    ]);
    const parent = issue?.parentKey ? await this.jira.getIssue(issue.parentKey, 'user') : null;
    const description = clip(adfText(issue?.description).trim(), DESCRIPTION_LIMIT);
    const parentText = parent ? clip(adfText(parent.description).trim(), PARENT_LIMIT).text : '';
    const comments = (context?.comments ?? []).filter((c) => c.text).map((c) => ({ author: c.author, at: c.at, text: clip(c.text, COMMENT_LIMIT).text }));
    return {
      workItem: {
        ...toWorkItem(view.issue),
        ...(context?.priority ? { priority: context.priority } : {}),
        ...(context?.assignee ? { assignee: context.assignee } : {}),
        ...(context?.reporter ? { reporter: context.reporter } : {}),
        ...(context?.dueDate ? { dueDate: context.dueDate } : {}),
        ...(context?.labels.length ? { labels: context.labels } : {}),
        ...(context?.components.length ? { components: context.components } : {}),
      },
      description: description.text,
      ...(description.cut ? { descriptionCut: true as const } : {}),
      ...(parent
        ? {
            parent: {
              key: parent.key,
              summary: parent.summary,
              type: parent.issueType,
              status: parent.statusName,
              ...(parentText ? { description: parentText } : {}),
            },
          }
        : {}),
      ...(context?.subtasks.length ? { subtasks: context.subtasks.map((s) => ({ key: s.key, summary: s.summary, status: s.statusName })) } : {}),
      ...(context?.links.length
        ? { links: context.links.map((l) => ({ relation: l.relation, key: l.key, summary: l.summary, status: l.statusName })) }
        : {}),
      ...(comments.length > 0 ? { comments } : {}),
      ...(context && context.commentTotal > comments.length ? { commentTotal: context.commentTotal } : {}),
      ...(linked && linked.items.length > 0 ? { development: linked.items.map(toAgentLinked) } : {}),
      ...(linked && linked.partial.length > 0 ? { developmentCut: true as const } : {}),
      contract: toAgentContract(view),
      rules: proofRules(view.policy),
    };
  }

  /** The project's work under contract that is not proven, and what the meter says. */
  async unproven(projectKey: unknown, windowDays: unknown): Promise<UnprovenWork> {
    const key = asText(projectKey).trim();
    if (!PROJECT_REF.test(key)) throw new PodError('invalid', 'Give the project key, for example ABC.');
    const project = await this.jira.getProject(key, 'user');
    if (!project) throw new PodError('not_found', `Project ${key} does not exist, or you do not have access to it.`);
    const view = await this.projects.overview(project.id, windowDays);
    const open = view.rows.filter((row) => row.proofState !== 'proven');
    let next = 'Call get-done-contract on a work item to see what each criterion needs.';
    if (open.length === 0) {
      next = view.contracts.total === 0 ? 'No work item in this project has a done contract yet.' : 'Every work item under contract in this project is proven.';
    }
    return {
      project: { key: view.project.key, name: view.project.name },
      meter: { verdict: view.meter.verdict, reason: view.meter.reason, windowDays: view.meter.windowDays },
      contracts: {
        total: view.contracts.total,
        proven: view.contracts.proven,
        closedWithoutProof: view.contracts.closedUnproven,
        waitingForReview: view.contracts.waiting,
      },
      workItems: open.slice(0, WORK_LISTED).map((row) => ({
        ...toWorkItem(row),
        proof: `${row.proven} of ${row.total} proven`,
        note: workNote(row),
      })),
      ...(open.length > WORK_LISTED ? { more: open.length - WORK_LISTED } : {}),
      next,
    };
  }

  /** The evidence on a work item that waits for a verdict, with what a reviewer needs to judge it. */
  async reviewQueue(issueKey: unknown, caller: Caller): Promise<ReviewQueue> {
    const view = await this.contracts.view(asText(issueKey), caller);
    const issue = await this.jira.getIssue(view.issue.id, 'user');
    const queued = view.criteria.flatMap((criterion) =>
      criterion.evidence.filter((evidence) => awaitsReview(evidence.standing, view.policy.requireIndependent)),
    );
    // One question to the graph covers every piece that waits on this work item.
    const linked = queued.some(graphCovers) ? await this.graph.linked(view.issue.id) : null;
    const waiting: ReviewItem[] = [];
    for (const criterion of view.criteria) {
      for (const evidence of criterion.evidence) {
        if (!awaitsReview(evidence.standing, view.policy.requireIndependent)) continue;
        const shown = toAgentEvidence(evidence);
        const note = linked ? compareWithGraph(evidence, linked) : null;
        waiting.push({
          evidenceId: evidence.id,
          criterionId: criterion.id,
          criterion: criterion.text,
          needs: criterion.requiredKind,
          kind: evidence.kind,
          summary: evidence.summary,
          ...(shown.url ? { url: shown.url } : {}),
          ...(shown.details ? { details: shown.details } : {}),
          submittedBy: shown.submittedBy,
          submittedAt: shown.submittedAt,
          checks: evidence.checks.map((check) => check.note),
          ...(note ? { graph: note.text } : {}),
        });
      }
    }
    let next =
      waiting.length === 1
        ? 'Call record-verdict for the one piece of evidence that waits.'
        : `Call record-verdict once for each of the ${waiting.length} pieces of evidence that wait.`;
    if (waiting.length === 0) {
      next = view.exists ? 'No evidence waits for a review on this work item.' : 'This work item has no done contract, so there is nothing to review.';
    }
    return {
      workItem: toWorkItem(view.issue),
      description: clip(adfText(issue?.description).trim(), REVIEW_DESCRIPTION_LIMIT).text,
      waiting,
      rules: waiting.some((item) => item.graph) ? [...REVIEW_RULES, GRAPH_RULE] : REVIEW_RULES,
      next,
    };
  }

  async verdict(input: Record<string, unknown>, caller: Caller): Promise<VerdictResult> {
    const evidenceId = asText(input['evidenceId']).trim();
    const view = await this.contracts.recordVerdict(asText(input['issueKey']), caller, {
      evidenceId,
      decision: toDecisionWord(input['decision']),
      reason: asText(input['reason']),
    });
    const criterion = view.criteria.find((c) => c.evidence.some((e) => e.id === evidenceId));
    const decision = criterion?.evidence.find((e) => e.id === evidenceId)?.verdict?.decision;
    if (!criterion || !decision) throw new Error('The verdict was recorded but could not be read back.');
    const left = view.criteria.flatMap((c) => c.evidence).filter((e) => awaitsReview(e.standing, view.policy.requireIndependent)).length;
    const parts = [
      left > 0
        ? `${count(left, 'more piece of evidence waits', 'more pieces of evidence wait')} for a review on this work item.`
        : 'No other evidence waits for a review on this work item.',
    ];
    if (view.summary.state === 'proven') parts.push('Every criterion is now proven.');
    return {
      evidenceId,
      decision,
      criterion: toAgentCriterion(criterion),
      proof: toProof(view),
      gate: toGate(view),
      next: parts.join(' '),
    };
  }
}
