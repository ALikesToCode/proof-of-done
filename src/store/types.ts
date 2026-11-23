import { Criterion, Evidence, ProjectSettings, ProofSummary, Verdict } from '../core/types';

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
}
