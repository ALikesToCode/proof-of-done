import {
  Criterion,
  CriterionState,
  Evidence,
  EvidenceChannel,
  EvidenceStanding,
  GateMode,
  ProofState,
  ProofSummary,
  Verdict,
  VerdictChannel,
} from './types';

/**
 * The rules that turn stored facts (evidence and verdicts, both append-only) into
 * states. Every state shown anywhere in the app is derived here from the same rows,
 * so a status can't drift away from its history.
 */

/**
 * Is this decider independent of the evidence?
 *
 * The one case that is not: a person accepting evidence they typed in themselves.
 * A person reviewing what their own coding agent submitted is independent review of
 * the agent's work, and that is the review this app exists to make happen.
 */
export function isIndependent(
  evidence: Pick<Evidence, 'channel' | 'actorAccountId'>,
  decider: { channel: VerdictChannel; actorAccountId: string | null },
): boolean {
  if (decider.channel === 'check') return true;
  if (decider.channel === 'verifier') return true;
  if (decider.channel === 'sample') return true;
  const byHand: EvidenceChannel = 'ui';
  if (evidence.channel !== byHand) return true;
  if (!decider.actorAccountId || !evidence.actorAccountId) return false;
  return decider.actorAccountId !== evidence.actorAccountId;
}

/**
 * A person's attestation is their own word, so no second person has to accept it.
 * It counts as independent when the person is not the one the work is assigned to.
 */
export function attestationIndependent(attesterAccountId: string | null, assigneeAccountId: string | null): boolean {
  if (!attesterAccountId) return false;
  return attesterAccountId !== assigneeAccountId;
}

/** The verdict that currently stands for a piece of evidence: the newest one. */
export function latestVerdict(evidenceId: string, verdicts: Verdict[]): Verdict | null {
  let latest: Verdict | null = null;
  for (const verdict of verdicts) {
    if (verdict.evidenceId !== evidenceId) continue;
    if (!latest || verdict.createdAt > latest.createdAt || (verdict.createdAt === latest.createdAt && verdict.id > latest.id)) {
      latest = verdict;
    }
  }
  return latest;
}

export function evidenceStanding(evidence: Evidence, verdicts: Verdict[]): EvidenceStanding {
  if (!evidence.checksPassed) return 'failed_checks';
  const verdict = latestVerdict(evidence.id, verdicts);
  if (!verdict) return 'pending';
  if (verdict.decision === 'rejected') return 'rejected';
  return verdict.independent ? 'accepted' : 'self_accepted';
}

/**
 * Whether a reviewer can still decide on evidence with this standing. Evidence its own
 * submitter accepted stays open where the project asks for an independent check.
 */
export function awaitsReview(standing: EvidenceStanding, requireIndependent: boolean): boolean {
  return standing === 'pending' || (standing === 'self_accepted' && requireIndependent);
}

export interface CriterionProof {
  state: CriterionState;
  /** Proven only because the project allows self-review. */
  selfReviewed: boolean;
  /** Accepted by its own submitter while the project requires an independent check. */
  needsIndependent: boolean;
}

export function criterionProof(
  criterionId: string,
  evidence: Evidence[],
  verdicts: Verdict[],
  requireIndependent: boolean,
): CriterionProof {
  const standings = evidence.filter((e) => e.criterionId === criterionId).map((e) => evidenceStanding(e, verdicts));
  const base = { selfReviewed: false, needsIndependent: false };
  if (standings.includes('accepted')) return { ...base, state: 'proven' };
  if (standings.includes('self_accepted')) {
    return requireIndependent
      ? { ...base, state: 'submitted', needsIndependent: true }
      : { ...base, state: 'proven', selfReviewed: true };
  }
  if (standings.includes('pending')) return { ...base, state: 'submitted' };
  if (standings.length > 0) return { ...base, state: 'rejected' };
  return { ...base, state: 'unproven' };
}

/**
 * The proof state of a whole work item. Partly proven means that some criteria are
 * proven. Evidence that waits for a check proves nothing yet, however much there is.
 */
export function proofStateOf(total: number, proven: number): ProofState {
  if (total <= 0) return 'none';
  if (proven >= total) return 'proven';
  return proven > 0 ? 'partial' : 'unproven';
}

export function summarize(
  criteria: Criterion[],
  evidence: Evidence[],
  verdicts: Verdict[],
  requireIndependent: boolean,
): ProofSummary {
  const summary: ProofSummary = { total: 0, proven: 0, submitted: 0, rejected: 0, unproven: 0, selfReviewed: 0, state: 'none' };
  for (const criterion of criteria) {
    if (!criterion.active) continue;
    summary.total++;
    const proof = criterionProof(criterion.id, evidence, verdicts, requireIndependent);
    summary[proof.state]++;
    if (proof.selfReviewed) summary.selfReviewed++;
  }
  summary.state = proofStateOf(summary.total, summary.proven);
  return summary;
}

export interface GateDecision {
  pass: boolean;
  reason: string;
}

/**
 * May this work item count as done? `summary` is null when it has no contract.
 * The gate mode decides what the app does about a "no"; this only decides the answer.
 */
export function gateDecision(
  summary: ProofSummary | null,
  policy: { gateMode: GateMode; enforceWithoutContract: boolean },
): GateDecision {
  if (policy.gateMode === 'off') return { pass: true, reason: 'The done gate is off for this project.' };
  if (!summary || summary.state === 'none') {
    return policy.enforceWithoutContract
      ? { pass: false, reason: 'This work item has no done contract, and the project requires one.' }
      : { pass: true, reason: 'No done contract, so nothing to prove.' };
  }
  if (summary.state === 'proven') {
    return { pass: true, reason: summary.total === 1 ? 'The one criterion is proven.' : `All ${summary.total} criteria are proven.` };
  }
  if (summary.total === 1) {
    if (summary.submitted) return { pass: false, reason: 'The evidence for the one criterion waits for a check.' };
    if (summary.rejected) return { pass: false, reason: 'The evidence for the one criterion was turned away.' };
    return { pass: false, reason: 'The one criterion has no evidence.' };
  }
  const missing = summary.total - summary.proven;
  const parts: string[] = [];
  if (summary.unproven) parts.push(`${summary.unproven} with no evidence`);
  if (summary.submitted) parts.push(`${summary.submitted} waiting for a check`);
  if (summary.rejected) parts.push(`${summary.rejected} rejected`);
  return {
    pass: false,
    reason: `${missing} of ${summary.total} criteria ${missing === 1 ? 'is' : 'are'} not proven (${parts.join(', ')}).`,
  };
}
