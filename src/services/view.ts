import { GateDecision } from '../core/proof';
import {
  CheckResult,
  CriterionSource,
  CriterionState,
  Decision,
  EvidenceChannel,
  EvidenceDetails,
  EvidenceKind,
  EvidenceStanding,
  GateMode,
  ProofSummary,
  RequiredKind,
  VerdictChannel,
} from '../core/types';

/**
 * What the issue panel and the agent tools receive. Everything here is derived from
 * stored rows at read time. This file holds types only, so the frontend can import it.
 */

export interface VerdictView {
  decision: Decision;
  reason: string;
  channel: VerdictChannel;
  actorAccountId: string | null;
  independent: boolean;
  createdAt: number;
}

export interface EvidenceView {
  id: string;
  kind: EvidenceKind;
  summary: string;
  /** The link, when it is an http or https address. A stored link of any other kind is left out. */
  url: string | null;
  details: EvidenceDetails;
  channel: EvidenceChannel;
  actorAccountId: string | null;
  agentName: string | null;
  checks: CheckResult[];
  standing: EvidenceStanding;
  /** The verdict that currently stands, if any. */
  verdict: VerdictView | null;
  createdAt: number;
  /** Whether the viewer may accept it. When not, `acceptBlocked` says why. */
  canAccept: boolean;
  canReject: boolean;
  acceptBlocked: string | null;
}

export interface CriterionView {
  id: string;
  text: string;
  source: CriterionSource;
  sourceRef: string | null;
  requiredKind: RequiredKind;
  state: CriterionState;
  selfReviewed: boolean;
  needsIndependent: boolean;
  /** Newest first. */
  evidence: EvidenceView[];
}

/** A criterion the app found but that is not in the contract. */
export interface Suggestion {
  text: string;
  requiredKind: RequiredKind;
  source: CriterionSource;
  sourceRef: string | null;
}

export interface ContractView {
  issue: {
    id: string;
    key: string;
    summary: string;
    issueType: string;
    statusName: string;
    statusCategory: string;
    projectId: string;
    assigneeAccountId: string | null;
  };
  exists: boolean;
  createdAt: number | null;
  createdBy: string | null;
  summary: ProofSummary;
  gate: GateDecision;
  policy: { requireIndependent: boolean; gateMode: GateMode };
  criteria: CriterionView[];
  suggestions: Suggestion[];
  canEdit: boolean;
  viewerAccountId: string | null;
}

export interface HistoryEntry {
  id: string;
  type: string;
  at: number;
  actorAccountId: string | null;
  channel: string | null;
  data: Record<string, unknown>;
}

export interface EvidenceInput {
  criterionId: string;
  kind: string;
  summary: string;
  url?: string | null;
  details?: unknown;
}

export interface VerdictInput {
  evidenceId: string;
  decision: string;
  reason?: string | null;
}

export interface CriterionInput {
  text: string;
  requiredKind?: string | null;
}
