import { Criterion, Evidence, ProjectSettings, ProofState, ProofSummary, Verdict } from '../core/types';

export interface ContractRow {
  issueId: string;
  issueKey: string;
  projectId: string;
  createdBy: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface EventRow {
  id: string;
  projectId: string;
  issueId: string | null;
  /** Dotted name, for example `evidence.submitted`. */
  type: string;
  at: number;
  actorAccountId: string | null;
  channel: string | null;
  data: Record<string, unknown>;
}

/** One contract with its stored proof counts, for lists that span a project. */
export interface ContractSummaryRow {
  issueId: string;
  issueKey: string;
  proofState: ProofState;
  total: number;
  proven: number;
  submitted: number;
  rejected: number;
  updatedAt: number;
}

export interface EventCount {
  type: string;
  /** How many events of this type. */
  count: number;
  /** On how many different work items. */
  issues: number;
}

/** A work item the app created as sample data, and which sample it is. */
export interface SampleMarker {
  issueId: string;
  slug: string;
}

/** Everything stored about one work item's contract. */
export interface ContractBundle {
  contract: ContractRow | null;
  criteria: Criterion[];
  evidence: Evidence[];
  verdicts: Verdict[];
}

/**
 * The storage the services need. The production implementation is Forge SQL; the unit
 * tests use an in-memory one. Evidence, verdicts and events are append-only.
 */
export interface ContractStore {
  getBundle(issueId: string): Promise<ContractBundle>;
  /** Returns false when the work item already had a contract. */
  createContract(row: ContractRow): Promise<boolean>;
  insertCriteria(criteria: Criterion[]): Promise<void>;
  deactivateCriterion(criterionId: string, issueId: string): Promise<void>;
  insertEvidence(evidence: Evidence, projectId: string): Promise<void>;
  insertVerdict(verdict: Verdict, projectId: string): Promise<void>;
  insertEvent(event: EventRow): Promise<void>;
  listEvents(issueId: string, limit: number): Promise<EventRow[]>;
  saveSummary(issueId: string, summary: ProofSummary, now: number): Promise<void>;
  getSettings(projectId: string): Promise<ProjectSettings>;
  saveSettings(projectId: string, settings: ProjectSettings, actorAccountId: string | null, now: number): Promise<void>;
  /** The project's contracts, most recently changed first. */
  listContracts(projectId: string, limit: number): Promise<ContractSummaryRow[]>;
  /** The project's events since `since`, counted by type. */
  countEvents(projectId: string, since: number): Promise<EventCount[]>;
  /** The work items the app created in this project as sample data. */
  listSampleIssues(projectId: string): Promise<SampleMarker[]>;
  markSample(issueId: string, projectId: string, slug: string, now: number): Promise<void>;
  /**
   * Deletes everything stored about one work item. This is the one exception to
   * append-only, and it is for a work item that no longer exists: one deleted in
   * Jira, or sample data being removed.
   */
  purgeIssue(issueId: string): Promise<void>;
}
