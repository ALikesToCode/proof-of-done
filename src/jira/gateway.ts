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

/** A project and the work item types it can create, sub-tasks left out. */
export interface ProjectInfo {
  id: string;
  key: string;
  name: string;
  issueTypes: Array<{ id: string; name: string }>;
}

/** A work item as one row of a list. */
export interface IssueRow {
  id: string;
  key: string;
  summary: string;
  issueType: string;
  statusName: string;
  statusCategory: string;
  assigneeAccountId: string | null;
  /** When it last moved between to do, in progress and done, in epoch milliseconds. */
  statusCategoryChangedAt: number | null;
}

export interface NewIssue {
  projectId: string;
  issueTypeId: string;
  summary: string;
  description: AdfNode;
  labels: string[];
}

export interface TransitionInfo {
  id: string;
  name: string;
  toStatusId: string;
  toStatusName: string;
  /** Category key of the status it leads to. */
  toCategory: string;
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
  /** Returns null when the project does not exist or the caller may not see it. */
  getProject(projectId: string, as: RunAs): Promise<ProjectInfo | null>;
  /** Whether the calling user administers the project, as a project admin or as a Jira admin. */
  canAdminister(projectId: string): Promise<boolean>;
  /** How many work items match the JQL. Jira calls this count approximate. */
  countIssues(jql: string, as: RunAs): Promise<number>;
  /** The listed work items that exist and that the caller may see, at most 100 per call. */
  getIssueRows(issueIds: string[], as: RunAs): Promise<IssueRow[]>;
  /** Creates a work item as the app. */
  createIssue(issue: NewIssue): Promise<{ id: string; key: string }>;
  /** Deletes a work item as the app. False when Jira refused. A work item that is already gone counts as deleted. */
  deleteIssue(issueId: string): Promise<boolean>;
}
