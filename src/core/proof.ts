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
  if (decider.channel === 'ci') return true;
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

/** Two commit ids name the same commit when one is the start of the other. Seven characters is the shortest id taken. */
export function sameCommit(a: string, b: string): boolean {
  const left = a.trim().toLowerCase();
  const right = b.trim().toLowerCase();
  if (left.length < 7 || right.length < 7) return left === right;
  return left.startsWith(right) || right.startsWith(left);
}

/**
 * The commit a work item stands at: the one in the newest result its project's pipeline
 * reported. Null until a pipeline has reported one. An agent or a person can name a commit
 * too, but only the pipeline's word moves this, because only the pipeline holds the key.
 */
export function pipelineCommit(evidence: Evidence[]): string | null {
  let newest: Evidence | null = null;
  for (const item of evidence) {
    if (item.channel !== 'ci' || !item.details.commit) continue;
    if (!newest || item.createdAt > newest.createdAt || (item.createdAt === newest.createdAt && item.id > newest.id)) newest = item;
  }
  return newest?.details.commit ?? null;
}

/**
 * The newest result the project's pipeline reported for one criterion, one kind of evidence
 * and one commit, or null when it has reported none. A rerun on the same commit replaces
 * the run before it.
 */
export function pipelineResultFor(evidence: Evidence[], criterionId: string, kind: Evidence['kind'], commit: string | undefined): Evidence | null {
  if (!commit) return null;
  let newest: Evidence | null = null;
  for (const item of evidence) {
    if (item.channel !== 'ci' || item.criterionId !== criterionId || item.kind !== kind) continue;
    if (!item.details.commit || !sameCommit(item.details.commit, commit)) continue;
    if (!newest || item.createdAt > newest.createdAt || (item.createdAt === newest.createdAt && item.id > newest.id)) newest = item;
  }
  return newest;
}

/** Why a piece of evidence failed its checks, in the words of the first check that failed. */
export function failedNote(evidence: Pick<Evidence, 'checks' | 'summary'>): string {
  return evidence.checks.find((check) => !check.ok)?.note ?? evidence.summary;
}

/** Evidence about a commit the pipeline has since moved past. Evidence that names no commit never goes stale. */
export function isStale(evidence: Pick<Evidence, 'details'>, current: string | null): boolean {
  const commit = evidence.details.commit;
  if (!commit || !current) return false;
  return !sameCommit(commit, current);
}

/** `current` is what `pipelineCommit` gave for the work item. Leave it out where no pipeline reports. */
export function evidenceStanding(evidence: Evidence, verdicts: Verdict[], current: string | null = null): EvidenceStanding {
  if (!evidence.checksPassed) return 'failed_checks';
  if (isStale(evidence, current)) return 'stale';
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
  /** Unproven, and all it has is proof of a commit the pipeline has moved past. */
  stale: boolean;
}

export function criterionProof(
  criterionId: string,
  evidence: Evidence[],
  verdicts: Verdict[],
  requireIndependent: boolean,
): CriterionProof {
  const current = pipelineCommit(evidence);
  const own = evidence.filter((e) => e.criterionId === criterionId);
  const standings = own.map((e) => evidenceStanding(e, verdicts, current));
  const base = { selfReviewed: false, needsIndependent: false, stale: false };
  if (standings.includes('accepted')) return { ...base, state: 'proven' };
  if (standings.includes('self_accepted')) {
    return requireIndependent
      ? { ...base, state: 'submitted', needsIndependent: true }
      : { ...base, state: 'proven', selfReviewed: true };
  }
  if (standings.includes('pending')) return { ...base, state: 'submitted' };
  // Proof that held until the pipeline moved on, with nothing turned away for the commit it is at now.
  // An older run that failed does not hide that: what the criterion lacks is proof of the new commit.
  const heldBefore = own.some((e, index) => {
    if (standings[index] !== 'stale') return false;
    const before = evidenceStanding(e, verdicts, null);
    return before === 'accepted' || (before === 'self_accepted' && !requireIndependent);
  });
  const turnedAwayNow = own.some(
    (e, index) => (standings[index] === 'rejected' || standings[index] === 'failed_checks') && !isStale(e, current),
  );
  if (heldBefore && !turnedAwayNow) return { ...base, state: 'unproven', stale: true };
  // A new commit turns earlier proof away without anyone having rejected it. The criterion is open again.
  if (standings.includes('stale') && !standings.includes('rejected') && !standings.includes('failed_checks')) {
    return { ...base, state: 'unproven', stale: true };
  }
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
  const summary: ProofSummary = { total: 0, proven: 0, submitted: 0, rejected: 0, unproven: 0, selfReviewed: 0, stale: 0, state: 'none' };
  for (const criterion of criteria) {
    if (!criterion.active) continue;
    summary.total++;
    const proof = criterionProof(criterion.id, evidence, verdicts, requireIndependent);
    summary[proof.state]++;
    if (proof.selfReviewed) summary.selfReviewed++;
    if (proof.stale) summary.stale++;
  }
  summary.state = proofStateOf(summary.total, summary.proven);
  return summary;
}

/** How long a work item that someone let through the done gate stays let through. */
export const PASS_MINUTES = 30;

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
    if (summary.stale) return { pass: false, reason: 'The proof of the one criterion is about an earlier commit.' };
    return { pass: false, reason: 'The one criterion has no evidence.' };
  }
  const missing = summary.total - summary.proven;
  const parts: string[] = [];
  const fresh = summary.unproven - (summary.stale ?? 0);
  if (fresh > 0) parts.push(`${fresh} with no evidence`);
  if (summary.stale) parts.push(`${summary.stale} proven only for an earlier commit`);
  if (summary.submitted) parts.push(`${summary.submitted} waiting for a check`);
  if (summary.rejected) parts.push(`${summary.rejected} rejected`);
  return {
    pass: false,
    reason: `${missing} of ${summary.total} criteria ${missing === 1 ? 'is' : 'are'} not proven (${parts.join(', ')}).`,
  };
}
