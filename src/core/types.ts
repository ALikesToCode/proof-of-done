/**
 * Domain types for Proof of Done. Nothing in src/core imports Forge, so all of it
 * runs under plain Node in the unit tests.
 *
 * Vocabulary:
 *  - A contract is the list of criteria a work item must meet before it counts as done.
 *  - Evidence is something submitted against one criterion: a test run, a build, a pull
 *    request, a document, or a person's attestation.
 *  - A verdict is a decision on one piece of evidence. Only a verdict from someone other
 *    than the submitter (an "independent" verdict) proves a criterion, unless the project
 *    turns that rule off.
 */

export const EVIDENCE_KINDS = ['test_run', 'build', 'pull_request', 'document', 'attestation', 'other'] as const;
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];

/** What kind of evidence a criterion asks for. `any` accepts every kind. */
export type RequiredKind = EvidenceKind | 'any';
export const REQUIRED_KINDS: readonly RequiredKind[] = ['any', ...EVIDENCE_KINDS];

/** Where a criterion came from. Shown in the UI so nobody mistakes a guess for a rule. */
export type CriterionSource = 'description' | 'parent' | 'project_rule' | 'manual' | 'suggested' | 'sample';

/** How evidence reached the app. `ui` is a person typing it in; `agent` is a tool call. */
export type EvidenceChannel = 'ui' | 'agent' | 'ci' | 'graph' | 'sample';

/**
 * Who decided. `check` is the app's own mechanical checks (they can only reject),
 * `verifier` is the Proof Verifier agent, `ui` is a person, `attestation` is the
 * decision implied by a person's signed statement, and `ci` is the project's pipeline
 * reporting its own result with the project's key.
 */
export type VerdictChannel = 'check' | 'verifier' | 'ui' | 'attestation' | 'ci' | 'sample';

export type Decision = 'accepted' | 'rejected';

export type CriterionState = 'unproven' | 'submitted' | 'proven' | 'rejected';

/**
 * Where one piece of evidence stands after checks and verdicts. `stale` is evidence about
 * a commit the project's pipeline has since moved past. It proves nothing any more.
 */
export type EvidenceStanding = 'failed_checks' | 'stale' | 'pending' | 'accepted' | 'self_accepted' | 'rejected';

/** Proof state of a whole work item. Also written to the issue property that JQL reads. */
export type ProofState = 'none' | 'unproven' | 'partial' | 'proven';

export interface Criterion {
  id: string;
  issueId: string;
  position: number;
  text: string;
  source: CriterionSource;
  /** Free-form pointer to the origin, for example the heading the text was found under. */
  sourceRef: string | null;
  requiredKind: RequiredKind;
  active: boolean;
  createdBy: string | null;
  /** Epoch milliseconds. */
  createdAt: number;
}

export interface CheckResult {
  /** Stable id of the check, for example `test_run.failed`. */
  id: string;
  ok: boolean;
  note: string;
}

/** Optional structured fields. Every one is validated before it is stored. */
export interface EvidenceDetails {
  passed?: number;
  failed?: number;
  skipped?: number;
  exitCode?: number;
  command?: string;
  commit?: string;
  /** The branch a pipeline ran on. */
  branch?: string;
  /** Where a pipeline ran: the repository, the workflow or job, and the run with its attempt. */
  repository?: string;
  workflow?: string;
  run?: string;
  /** Build result or pull request state, lower-cased. */
  status?: string;
  /** Short excerpt: a log tail, or the wording of an attestation. */
  text?: string;
}

export interface Evidence {
  id: string;
  criterionId: string;
  issueId: string;
  kind: EvidenceKind;
  summary: string;
  url: string | null;
  details: EvidenceDetails;
  channel: EvidenceChannel;
  /** The Atlassian account the call ran as. For an agent this is the person who authorised it. */
  actorAccountId: string | null;
  /** Name the agent gave for itself. A claim, not a verified identity. */
  agentName: string | null;
  checks: CheckResult[];
  checksPassed: boolean;
  createdAt: number;
}

export interface Verdict {
  id: string;
  evidenceId: string;
  criterionId: string;
  issueId: string;
  decision: Decision;
  reason: string;
  channel: VerdictChannel;
  actorAccountId: string | null;
  /** False when the decider is the same person who submitted the evidence by hand. */
  independent: boolean;
  createdAt: number;
}

export interface ProofSummary {
  total: number;
  proven: number;
  submitted: number;
  rejected: number;
  unproven: number;
  /** Criteria that count as proven only because the project allows self-review. */
  selfReviewed: number;
  /** Criteria whose only proof is about a commit the pipeline has moved past. Counted in `unproven`. */
  stale: number;
  state: ProofState;
}

export type GateMode = 'off' | 'warn' | 'bounce';

export interface ProjectRule {
  id: string;
  text: string;
  requiredKind: RequiredKind;
  /** Issue type names the rule applies to. Empty means every type. */
  issueTypes: string[];
}

export interface ProjectSettings {
  /** When true, only a verdict from someone other than the submitter proves a criterion. */
  requireIndependent: boolean;
  /** What happens when a work item reaches a done status without proof. */
  gateMode: GateMode;
  /** When true, a work item with no contract also fails the gate. */
  enforceWithoutContract: boolean;
  /**
   * What the workflow validator answers when it could not check a work item, because Jira
   * or the app's storage did not answer or the app may not read the work item. True
   * refuses the transition. False lets it through and says so in the work item's history.
   */
  strictGate: boolean;
  /** When true, a passing result that the project's pipeline reports proves its criterion without a person. */
  pipelineProves: boolean;
  /** When true, a test run or a build counts only when the project's pipeline reports it. */
  pipelineOnly: boolean;
  rules: ProjectRule[];
}
