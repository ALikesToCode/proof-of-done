import { AdfNode } from '../core/adf';
import { ProofState } from '../core/types';

/** The parts of a Jira work item this app reads. */
export interface IssueInfo {
  id: string;
  key: string;
  projectId: string;
  projectKey: string;
  summary: string;
  description: AdfNode | null;
  issueType: string;
  statusName: string;
  /** Jira's status category key: `new`, `indeterminate` or `done`. */
  statusCategory: string;
  assigneeAccountId: string | null;
  parentKey: string | null;
}

/** Stored on the work item as an entity property so JQL and other apps can read the proof state. */
export interface ProofProperty {
  state: ProofState;
  proven: number;
  total: number;
  /** Criteria still to prove. */
  open: number;
  selfReviewed: number;
  /** ISO 8601 time of the last change. */
  updated: string;
}

export const PROOF_PROPERTY_KEY = 'proof-of-done';

/**
 * `user` runs with the permissions of the person who made the call, so Jira decides
 * what they may see. `app` is for work no person asked for, such as event triggers.
 */
export type RunAs = 'user' | 'app';

export interface TransitionInfo {
  id: string;
  name: string;
  toStatusId: string;
  toStatusName: string;
}

export interface JiraGateway {
  /** Returns null when the work item does not exist or the caller may not see it. */
  getIssue(idOrKey: string, as: RunAs): Promise<IssueInfo | null>;
  /** Whether the calling user may edit the work item. */
  canEdit(issueId: string): Promise<boolean>;
  setProofProperty(issueId: string, value: ProofProperty): Promise<void>;
  /** Jira's category key of a status (`new`, `indeterminate`, `done`), or null if unknown. */
  getStatusCategory(statusId: string): Promise<string | null>;
  /** The transitions the app can make on a work item right now. */
  listTransitions(issueId: string): Promise<TransitionInfo[]>;
  transition(issueId: string, transitionId: string): Promise<void>;
  /** Adds a comment as the app, one paragraph per entry. */
  addComment(issueId: string, paragraphs: string[]): Promise<void>;
}
