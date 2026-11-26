import type {
  CriterionSource,
  EvidenceDetails,
  EvidenceKind,
  EvidenceStanding,
  ProofState,
  RequiredKind,
} from '../core/types';
import type { GraphFinding } from '../core/graph';
import { awaitsReview } from '../core/proof';
import type { ContractView, CriterionView, EvidenceView, HistoryEntry } from '../services/view';
import { GUIDE_STEPS, GUIDE_WORKFLOW } from '../core/sample';

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
  stale: { label: 'Earlier commit', tone: 'moved' },
  pending: { label: 'Waiting for a check', tone: 'inprogress' },
  accepted: { label: 'Accepted', tone: 'success' },
  self_accepted: { label: 'Self-reviewed', tone: 'moved' },
  rejected: { label: 'Rejected', tone: 'removed' },
};

/** How a piece of evidence compares with what the Teamwork Graph links to its work item. */
export const GRAPH_FINDING: Record<GraphFinding, Badge> = {
  confirmed: { label: 'Confirmed', tone: 'success' },
  differs: { label: 'Differs', tone: 'removed' },
  not_linked: { label: 'Not linked', tone: 'moved' },
  no_record: { label: 'No record', tone: 'default' },
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

export function criterionBadge(criterion: Pick<CriterionView, 'state' | 'selfReviewed' | 'needsIndependent'> & { stale?: boolean }): Badge {
  if (criterion.stale) return { label: 'Proven for an earlier commit', tone: 'moved' };
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

export function channelLine(evidence: Pick<EvidenceView, 'channel' | 'agentName'> & { details?: { workflow?: string } }): string {
  switch (evidence.channel) {
    case 'agent':
      return evidence.agentName ? `Submitted by the agent ${evidence.agentName}` : 'Submitted by an agent';
    case 'ci':
      // The guided run stores its results the way a pipeline's are stored, and marks them with its workflow name.
      return evidence.details?.workflow === GUIDE_WORKFLOW
        ? "Sample data, as if reported by the project's pipeline"
        : "Reported by the project's pipeline";
    case 'graph':
      return 'Found through Teamwork Graph';
    case 'sample':
      return evidence.agentName ? `Sample data, as if submitted by the agent ${evidence.agentName}` : 'Sample data, as if added by a person';
    default:
      return 'Added by hand';
  }
}

/** A commit id as people quote it. */
export const shortCommit = (commit: string): string => (/^[0-9a-f]{12,}$/i.test(commit) ? commit.slice(0, 7) : commit);

/** How the panel words the state a pull request was entered with. Anything else is shown as it came. */
const PULL_REQUEST_STATE: Record<string, string> = { closed: 'closed without merging' };

/** The structured fields of a piece of evidence as short lines. */
export function detailLines(details: EvidenceDetails, kind?: EvidenceKind): string[] {
  const lines: string[] = [];
  if (details.passed !== undefined || details.failed !== undefined) {
    const parts = [`${details.passed ?? 0} passed`, `${details.failed ?? 0} failed`];
    if (details.skipped !== undefined) parts.push(`${details.skipped} skipped`);
    lines.push(parts.join(', '));
  }
  if (details.status) {
    lines.push(kind === 'pull_request' ? `State: ${PULL_REQUEST_STATE[details.status] ?? details.status}` : `Result: ${details.status}`);
  }
  if (details.exitCode !== undefined) lines.push(`Exit code ${details.exitCode}`);
  if (details.command) lines.push(`Command: ${details.command}`);
  if (details.commit) lines.push(`Commit ${shortCommit(details.commit)}${details.branch ? ` on ${details.branch}` : ''}`);
  const ran = [details.repository, details.workflow, details.run ? `run ${details.run}` : ''].filter(Boolean);
  if (ran.length > 0) lines.push(`Ran in ${ran.join(', ')}`);
  return lines;
}

/** How much of an excerpt the panel shows before someone asks for the rest. */
const EXCERPT_LINES = 6;
const EXCERPT_CHARS = 480;

/** The start of an excerpt, and whether that leaves anything out. */
export function excerptHead(text: string): { head: string; cut: boolean } {
  const whole = text.replace(/\r\n?/g, '\n').trim();
  const head = whole.split('\n').slice(0, EXCERPT_LINES).join('\n').slice(0, EXCERPT_CHARS);
  return { head: head.trimEnd(), cut: head.length < whole.length };
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
      if (data['by'] === 'check') return `reported a result that contradicts evidence for ${quote(data['text'])}, so the app turned that evidence away.${sentence(data['reason'])}`;
      const who = data['by'] === 'verifier' ? 'asked the Proof Verifier, which ' : '';
      const self = data['decision'] === 'accepted' && data['independent'] === false ? ' as a self-review' : '';
      const reason = typeof data['reason'] === 'string' && data['reason'] && data['reason'] !== 'Accepted.' ? ` Reason: ${data['reason']}` : '';
      return `${who}${verb} evidence for ${quote(data['text'])}${self}.${reason}`;
    }
    case 'proof.stale': {
      const count = Number(data['criteria'] ?? 0);
      const commit = typeof data['commit'] === 'string' ? shortCommit(data['commit']) : 'a new commit';
      return `reported commit ${commit}, so ${count === 1 ? 'one criterion is' : `${count} criteria are`} open again: the proof was about an earlier commit`;
    }
    case 'pipeline.key_created':
      return "made the key the project's pipeline reports with";
    case 'pipeline.key_replaced':
      return "replaced the pipeline's key, so the one before stopped working";
    case 'pipeline.key_removed':
      return "removed the pipeline's key";
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
    case 'sample.step': {
      const step = GUIDE_STEPS.find((candidate) => candidate.id === data['step']);
      const answer = data['pass'] === true ? 'could close' : 'could not close';
      return `ran a step of the guided sample${step ? `: ${step.label.charAt(0).toLowerCase()}${step.label.slice(1)}` : ''}. After it the work item ${answer}.${sentence(data['reason'])}`;
    }
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
  if (entry.channel === 'ci') return "The project's pipeline";
  return entry.channel === 'sample' ? 'Sample data' : 'The app';
}

/** The Rovo agent that reviews evidence. The key and the name are the ones in the manifest. */
export const VERIFIER = { agentKey: 'proof-verifier', agentName: 'Proof Verifier' } as const;

/** How many pieces of evidence still wait for someone to decide on them. */
export function waitingForReview(view: Pick<ContractView, 'criteria' | 'policy'>): number {
  return view.criteria.reduce(
    (sum, criterion) => sum + criterion.evidence.filter((e) => awaitsReview(e.standing, view.policy.requireIndependent)).length,
    0,
  );
}

export function waitingLine(waiting: number): string {
  return waiting === 1 ? '1 piece of evidence waits for a check.' : `${waiting} pieces of evidence wait for a check.`;
}

/** What the panel says to the Proof Verifier when it opens Rovo chat. */
export function verifierPrompt(issueKey: string): string {
  return `Review the evidence that waits for a verdict on ${issueKey}.`;
}

export function proofLine(proven: number, total: number): string {
  if (total === 0) return 'No criteria yet';
  return `${proven} of ${total} ${total === 1 ? 'criterion' : 'criteria'} proven`;
}
