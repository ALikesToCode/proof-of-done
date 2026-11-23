import { Meter } from '../core/meter';
import { ProjectSettings, ProofState } from '../core/types';

/**
 * What the project page receives. Types only, so the frontend can import this file.
 */

/** Why a work item under contract deserves a look, most urgent first. */
export type Attention = 'closed_unproven' | 'rejected' | 'waiting' | 'open' | 'none';

export interface WorkItemRow {
  id: string;
  key: string;
  summary: string;
  issueType: string;
  statusName: string;
  statusCategory: string;
  assigneeAccountId: string | null;
  proofState: ProofState;
  proven: number;
  total: number;
  /** Criteria with evidence that waits for a check. */
  waiting: number;
  /** Criteria whose evidence was all turned away. */
  rejected: number;
  attention: Attention;
  sample: boolean;
}

export interface ProjectView {
  project: { id: string; key: string; name: string };
  /** Whether the viewer administers the project, and so may change settings and sample data. */
  canAdmin: boolean;
  settings: ProjectSettings;
  /** Names of the project's work item types, for scoping a rule. */
  issueTypes: string[];
  meter: Meter;
  contracts: {
    /** Contracts the app has in this project. */
    total: number;
    /** The ones listed below. Less than the total when the viewer cannot see some, or there are very many. */
    listed: number;
    proven: number;
    closedUnproven: number;
    waiting: number;
  };
  /** Work items under contract, the ones that need attention first. */
  rows: WorkItemRow[];
  sample: { loaded: number; size: number };
}

export interface SampleStep {
  /** Position of the work item that was just made, counting from 1. */
  step: number;
  total: number;
  key: string;
  summary: string;
  /** True when the work item was already there from an earlier load. */
  existed: boolean;
}

export interface SampleRemoval {
  removed: number;
  /** Keys or ids of sample work items Jira would not delete. */
  kept: string[];
}
