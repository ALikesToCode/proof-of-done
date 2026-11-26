import { LinkedKind } from '../core/graph';
import { MeterVerdict } from '../core/meter';
import { Decision, EvidenceDetails, EvidenceKind, GateMode, ProofState, RequiredKind } from '../core/types';

/**
 * What the agent tools return. The reader is a language model, so every state is a
 * plain word, empty fields are left out, and a `next` line says what to do.
 * Types only.
 */

export type AgentStanding = 'failed_checks' | 'stale_commit' | 'waiting_for_review' | 'accepted' | 'accepted_by_submitter' | 'rejected';
export type AgentCriterionState = 'no_evidence' | 'waiting_for_review' | 'proven' | 'rejected';

export interface AgentEvidence {
  id: string;
  kind: EvidenceKind;
  summary: string;
  url?: string;
  details?: EvidenceDetails;
  /** Who sent it in, in words. An agent's name is its own claim. */
  submittedBy: string;
  /** ISO 8601. */
  submittedAt: string;
  standing: AgentStanding;
  /** Why the automatic checks turned it away. */
  problems?: string[];
  verdict?: { decision: Decision; reason: string; by: string };
}

export interface AgentCriterion {
  id: string;
  text: string;
  /** The kind of evidence this criterion takes. `any` takes every kind. */
  needs: RequiredKind;
  state: AgentCriterionState;
  next: string;
  /** Newest first, the latest few. */
  evidence: AgentEvidence[];
  /** How many pieces of evidence there are, when more than the ones shown. */
  evidenceTotal?: number;
}

export interface AgentWorkItem {
  key: string;
  summary: string;
  type: string;
  status: string;
  /** True when the work item is in a done status. */
  done: boolean;
}

export interface AgentProof {
  state: ProofState;
  proven: number;
  total: number;
}

export interface AgentGate {
  /** Whether the work item may count as done right now. */
  passes: boolean;
  mode: GateMode;
  reason: string;
}

export interface AgentContract {
  workItem: AgentWorkItem;
  hasContract: boolean;
  proof: AgentProof;
  gate: AgentGate;
  /** The commit the project's pipeline last reported on for this work item. Evidence about an earlier commit does not count. */
  commit?: string;
  criteria: AgentCriterion[];
  /** Criteria found in the description or the project rules that are not in the contract. */
  suggested?: Array<{ text: string; needs: RequiredKind; from: string }>;
  next: string;
}

/** A pull request, build or deployment that Jira's Teamwork Graph links to the work item. */
export interface AgentLinkedItem {
  kind: LinkedKind;
  /** What the tool it came from calls it. */
  name: string;
  url?: string;
  /** In plain words, such as merged, open, successful or failed. */
  state?: string;
  /** Where a deployment went. */
  environment?: string;
  /** The tool it came from, for example GitHub. */
  provider?: string;
  /** ISO 8601. */
  updatedAt?: string;
}

export interface SubmitResult {
  evidenceId: string;
  /** False when the automatic checks turned the evidence away. */
  passedChecks: boolean;
  problems: string[];
  /** What Jira's Teamwork Graph holds about the pull request or build behind this evidence. The reviewer sees it too. */
  graph?: string;
  criterion: AgentCriterion;
  proof: AgentProof;
  gate: AgentGate;
  next: string;
}

export interface ContextPack {
  workItem: AgentWorkItem & {
    priority?: string;
    assignee?: string;
    reporter?: string;
    dueDate?: string;
    labels?: string[];
    components?: string[];
  };
  description: string;
  /** Present when the description was cut to fit. */
  descriptionCut?: true;
  parent?: { key: string; summary: string; type: string; status: string; description?: string };
  subtasks?: Array<{ key: string; summary: string; status: string }>;
  links?: Array<{ relation: string; key: string; summary: string; status: string }>;
  /** The latest comments, newest first. */
  comments?: Array<{ author: string; at: string; text: string }>;
  /** How many comments the work item has, when more than the ones shown. */
  commentTotal?: number;
  /** The pull requests, builds and deployments that Jira's Teamwork Graph links to the work item. */
  development?: AgentLinkedItem[];
  /** Present when the list may be incomplete: the graph holds more than the ones listed, or it left a part out. */
  developmentCut?: true;
  contract: AgentContract;
  /** What an agent has to know about how proof works here. */
  rules: string[];
}

export interface UnprovenWork {
  project: { key: string; name: string };
  meter: { verdict: MeterVerdict; reason: string; windowDays: number };
  contracts: { total: number; proven: number; closedWithoutProof: number; waitingForReview: number };
  /** Work items under contract that are not proven, the most urgent first. */
  workItems: Array<AgentWorkItem & { proof: string; note: string }>;
  /** How many more there are than the ones listed. */
  more?: number;
  next: string;
}

export interface ReviewItem {
  evidenceId: string;
  criterionId: string;
  criterion: string;
  needs: RequiredKind;
  kind: EvidenceKind;
  summary: string;
  url?: string;
  details?: EvidenceDetails;
  submittedBy: string;
  submittedAt: string;
  /** What the automatic checks noted. They all passed, or the evidence would not be here. */
  checks: string[];
  /** What Jira's Teamwork Graph holds about the pull request or build behind this evidence. A second source next to what the evidence says. */
  graph?: string;
}

export interface ReviewQueue {
  workItem: AgentWorkItem;
  /** The work item's description, so each criterion can be read in context. */
  description: string;
  waiting: ReviewItem[];
  /** How to judge, in short. */
  rules: string[];
  next: string;
}

export interface VerdictResult {
  evidenceId: string;
  decision: Decision;
  criterion: AgentCriterion;
  proof: AgentProof;
  gate: AgentGate;
  next: string;
}
