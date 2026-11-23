import type {
  CriterionSource,
  EvidenceDetails,
  EvidenceKind,
  EvidenceStanding,
  ProofState,
  RequiredKind,
} from '../core/types';
import type { CriterionView, EvidenceView, HistoryEntry } from '../services/view';

/** Wording and small formatters for the panel. No Forge imports, so it can be unit-tested. */

export type Tone = 'default' | 'inprogress' | 'moved' | 'new' | 'removed' | 'success';
export interface Badge {
  label: string;
  tone: Tone;
}

export const PROOF_STATE: Record<ProofState, Badge> = {
  none: { label: 'No criteria', tone: 'default' },
  unproven: { label: 'Not proven', tone: 'default' },
  partial: { label: 'Partly proven', tone: 'inprogress' },
  proven: { label: 'Proven', tone: 'success' },
};

export const STANDING: Record<EvidenceStanding, Badge> = {
  failed_checks: { label: 'Failed checks', tone: 'removed' },
  pending: { label: 'Waiting for a check', tone: 'inprogress' },
  accepted: { label: 'Accepted', tone: 'success' },
  self_accepted: { label: 'Self-reviewed', tone: 'moved' },
  rejected: { label: 'Rejected', tone: 'removed' },
};

export const KIND: Record<EvidenceKind, string> = {
  test_run: 'Test run',
  build: 'Build',
  pull_request: 'Pull request',
  document: 'Document',
  attestation: 'Attestation',
  other: 'Other',
};

export const REQUIRED: Record<RequiredKind, string> = {
  any: 'Any evidence',
  test_run: 'A test run',
  build: 'A build',
  pull_request: 'A pull request',
  document: 'A document',
  attestation: "A person's attestation",
  other: 'Other evidence',
};

export function criterionBadge(criterion: Pick<CriterionView, 'state' | 'selfReviewed' | 'needsIndependent'>): Badge {
  switch (criterion.state) {
    case 'proven':
      return criterion.selfReviewed ? { label: 'Proven, self-reviewed', tone: 'moved' } : { label: 'Proven', tone: 'success' };
    case 'submitted':
      return criterion.needsIndependent
        ? { label: 'Needs a second person', tone: 'moved' }
        : { label: 'Waiting for a check', tone: 'inprogress' };
    case 'rejected':
      return { label: 'Evidence rejected', tone: 'removed' };
    default:
      return { label: 'No evidence', tone: 'default' };
  }
}

export function sourceLine(source: CriterionSource, sourceRef: string | null): string {
  switch (source) {
    case 'description':
      return sourceRef ? `From the description, under "${sourceRef}"` : 'From the description';
    case 'project_rule':
      return 'Project rule';
    case 'parent':
      return 'From the parent work item';
    case 'suggested':
      return 'Drafted by Rovo, accepted by a person';
    case 'sample':
      return 'Sample data';
    default:
      return 'Added by hand';
  }
}

export function channelLine(evidence: Pick<EvidenceView, 'channel' | 'agentName'>): string {
  switch (evidence.channel) {
    case 'agent':
      return evidence.agentName ? `Submitted by the agent ${evidence.agentName}` : 'Submitted by an agent';
    case 'ci':
      return 'Sent by CI';
    case 'graph':
      return 'Found through Teamwork Graph';
    case 'sample':
      return evidence.agentName ? `Sample data, as if submitted by the agent ${evidence.agentName}` : 'Sample data, as if added by a person';
    default:
      return 'Added by hand';
  }
}

/** The structured fields of a piece of evidence as short lines. */
export function detailLines(details: EvidenceDetails): string[] {
  const lines: string[] = [];
  if (details.passed !== undefined || details.failed !== undefined) {
    const parts = [`${details.passed ?? 0} passed`, `${details.failed ?? 0} failed`];
    if (details.skipped !== undefined) parts.push(`${details.skipped} skipped`);
    lines.push(parts.join(', '));
  }
  if (details.status) lines.push(`Result: ${details.status}`);
  if (details.exitCode !== undefined) lines.push(`Exit code ${details.exitCode}`);
  if (details.command) lines.push(`Command: ${details.command}`);
  if (details.commit) lines.push(`Commit ${details.commit}`);
  return lines;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function timeAgo(at: number, now: number): string {
  const seconds = Math.max(0, Math.round((now - at) / 1000));
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 2) return 'a minute ago';
  if (minutes < 45) return `${minutes} minutes ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 2) return 'an hour ago';
  if (hours < 22) return `${hours} hours ago`;
  const days = Math.round(hours / 24);
  if (days < 2) return 'yesterday';
  if (days < 26) return `${days} days ago`;
  const date = new Date(at);
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

const quote = (value: unknown): string => {
  const text = typeof value === 'string' ? value : '';
  return text.length > 90 ? `"${text.slice(0, 87).trimEnd()}..."` : `"${text}"`;
};

/** What happened, as a phrase that follows the name of whoever did it. */
export function describeEvent(entry: Pick<HistoryEntry, 'type' | 'data'>): string {
  const data = entry.data ?? {};
  switch (entry.type) {
    case 'contract.created': {
      const count = Number(data['criteria'] ?? 0);
      return count > 0 ? `created the contract with ${count} ${count === 1 ? 'criterion' : 'criteria'}` : 'created an empty contract';
    }
    case 'criterion.added':
      return `added the criterion ${quote(data['text'])}`;
    case 'criterion.replaced':
      return data['text'] === data['previousText']
        ? `changed what ${quote(data['text'])} needs`
        : `changed ${quote(data['previousText'])} to ${quote(data['text'])}`;
    case 'criterion.removed':
      return `removed the criterion ${quote(data['text'])}`;
    case 'evidence.submitted': {
      const kind = KIND[data['kind'] as EvidenceKind] ?? 'Evidence';
      const failed = data['checksPassed'] === false ? ' It failed its checks.' : '';
      return `submitted ${kind.toLowerCase()} evidence for ${quote(data['text'])}.${failed}`;
    }
    case 'verdict.recorded': {
      if (data['by'] === 'attestation') return `attested ${quote(data['text'])}`;
      const verb = data['decision'] === 'accepted' ? 'accepted' : 'rejected';
      const who = data['by'] === 'verifier' ? 'asked the Proof Verifier, which ' : '';
      const self = data['decision'] === 'accepted' && data['independent'] === false ? ' as a self-review' : '';
      const reason = typeof data['reason'] === 'string' && data['reason'] && data['reason'] !== 'Accepted.' ? ` Reason: ${data['reason']}` : '';
      return `${who}${verb} evidence for ${quote(data['text'])}${self}.${reason}`;
    }
    case 'proof.completed':
      return 'made the last change that proved every criterion';
    case 'proof.reopened':
      return 'made a change that left the work item no longer fully proven';
    case 'issue.done': {
      const status = statusName(data['status'], 'a done status');
      if (data['contract'] === false) return `moved the work item to ${status} before it had a contract`;
      return data['proven'] === true
        ? `moved the work item to ${status} with every criterion proven`
        : `moved the work item to ${status} without proof`;
    }
    case 'issue.reopened':
      return `moved the work item from ${statusName(data['fromStatus'], 'a done status')} back to ${statusName(data['status'], 'an open status')}`;
    case 'gate.warned':
      return `got a warning from the done gate.${sentence(data['reason'])}`;
    case 'gate.bounced':
      return `closed the work item without proof, and the done gate moved it back to ${statusName(data['backTo'], 'where it was')}.${sentence(data['reason'])}`;
    case 'gate.blocked':
      return `tried to move the work item on, and the workflow validator refused.${sentence(data['reason'])}`;
    default:
      return entry.type;
  }
}

const statusName = (value: unknown, fallback: string): string => (typeof value === 'string' && value ? value : fallback);
const sentence = (value: unknown): string => (typeof value === 'string' && value ? ` ${value}` : '');

/** Who an entry in the history is attributed to when no person did it. */
export function actorLabel(entry: Pick<HistoryEntry, 'channel'>): string {
  return entry.channel === 'sample' ? 'Sample data' : 'The app';
}

export function proofLine(proven: number, total: number): string {
  if (total === 0) return 'No criteria yet';
  return `${proven} of ${total} ${total === 1 ? 'criterion' : 'criteria'} proven`;
}
