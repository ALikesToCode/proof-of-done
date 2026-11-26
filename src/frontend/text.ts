import type {
  CriterionSource,
  EvidenceDetails,
  EvidenceKind,
  EvidenceStanding,
  ProofState,
  RequiredKind,
} from '../core/types';
import type { GraphFinding } from '../core/graph';
import { PASS_MINUTES, awaitsReview } from '../core/proof';
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

/**
 * Where a piece of evidence comes from, as one word a reviewer can weigh at a glance.
 * The pipeline holds a key nobody else has. Everything else is somebody's word.
 */
export function sourceBadge(evidence: Pick<EvidenceView, 'channel'> & { details?: { workflow?: string } }): Badge {
  switch (evidence.channel) {
    case 'ci':
      return evidence.details?.workflow === GUIDE_WORKFLOW ? { label: 'Sample pipeline', tone: 'default' } : { label: 'Pipeline', tone: 'success' };
    case 'agent':
      return { label: "Agent's claim", tone: 'moved' };
    case 'graph':
      return { label: 'Teamwork Graph', tone: 'new' };
    case 'sample':
      return { label: 'Sample data', tone: 'default' };
    default:
      return { label: 'Typed by a person', tone: 'default' };
  }
}

const sameCommitId = (a: string, b: string): boolean => {
  const left = a.trim().toLowerCase();
  const right = b.trim().toLowerCase();
  return left.length >= 7 && right.length >= 7 ? left.startsWith(right) || right.startsWith(left) : left === right;
};

/**
 * What the project's pipeline says about the commit a piece of evidence names. This is
 * the first thing a reviewer needs for a test run or a build that someone else reported.
 * Null when there is nothing to say: the evidence is the pipeline's own, or it is of a
 * kind a pipeline does not report.
 */
export function pipelineNote(criterion: Pick<CriterionView, 'evidence'>, evidence: Pick<EvidenceView, 'id' | 'kind' | 'channel' | 'details'>): string | null {
  if (evidence.channel === 'ci' || (evidence.kind !== 'test_run' && evidence.kind !== 'build')) return null;
  const commit = evidence.details.commit;
  if (!commit) return 'This names no commit, so no pipeline result can be set against it. It is the word of whoever sent it.';
  const reported = criterion.evidence
    .filter((other) => other.channel === 'ci' && other.kind === evidence.kind && other.details.commit && sameCommitId(other.details.commit, commit))
    .sort((a, b) => b.createdAt - a.createdAt)[0];
  if (!reported) return `The project's pipeline has not reported on commit ${shortCommit(commit)}. This is the word of whoever sent it.`;
  return reported.standing === 'failed_checks'
    ? `The project's pipeline reported on commit ${shortCommit(commit)} too, and its result does not pass.`
    : `The project's pipeline reported on commit ${shortCommit(commit)} too, and its result passes.`;
}

export interface Blocker {
  /** The criterion's id. */
  id: string;
  text: string;
  /** What keeps it from counting as proven, and what would change that. */
  why: string;
}

/** The criteria that keep a work item from closing, each with the reason in plain words. */
export function blockers(view: Pick<ContractView, 'criteria' | 'policy' | 'commit'>): Blocker[] {
  const found: Blocker[] = [];
  for (const criterion of view.criteria) {
    if (criterion.state === 'proven') continue;
    const fromPipeline = criterion.requiredKind === 'test_run' || criterion.requiredKind === 'build';
    const needs = criterion.requiredKind === 'any' ? '' : ` It needs ${REQUIRED[criterion.requiredKind].toLowerCase()}.`;
    let why: string;
    if (criterion.stale) {
      why = view.commit
        ? `Proven for an earlier commit. It needs proof of commit ${shortCommit(view.commit)}.`
        : 'Proven for an earlier commit. It needs proof of the newest one.';
    } else if (criterion.state === 'submitted') {
      const waiting = criterion.evidence.filter((e) => awaitsReview(e.standing, view.policy.requireIndependent)).length;
      why = criterion.needsIndependent
        ? 'Accepted by the person who entered it. It needs a second person.'
        : `${waiting === 1 ? 'One piece of evidence waits' : `${waiting} pieces of evidence wait`} for a check.`;
    } else if (criterion.state === 'rejected') {
      const newest = criterion.evidence[0];
      const reason =
        newest?.standing === 'failed_checks'
          ? newest.checks.find((check) => !check.ok)?.note
          : newest?.standing === 'rejected'
            ? newest.verdict?.reason
            : undefined;
      why = `The evidence was turned away.${reason ? ` ${reason}` : ''}`;
    } else {
      why = `No evidence yet.${needs}${view.policy.pipelineOnly && fromPipeline ? ' Only the pipeline can report it.' : ''}`;
    }
    found.push({ id: criterion.id, text: criterion.text, why });
  }
  return found;
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
      if (data['letThrough'] === true) return `moved the work item to ${status} without proof, let through by someone who administers the project`;
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
      return data['unchecked'] === true
        ? `tried to move the work item on, and the workflow validator refused because it could not check.${sentence(data['reason'])}`
        : `tried to move the work item on, and the workflow validator refused.${sentence(data['reason'])}`;
    case 'gate.unchecked':
      return `moved the work item on while the workflow validator could not check it. The project lets that through.${sentence(data['reason'])}`;
    case 'gate.pass_granted':
      return `let the work item through the done gate for ${PASS_MINUTES} minutes, without proof.${sentence(reasonOf(data['reason']))}`;
    case 'brief.written':
      return `asked the Proof Verifier, which wrote a repair brief for the coding agent: ${quote(data['text'])}`;
    case 'brief.removed':
      return 'removed the repair brief';
    case 'gate.let_through':
      return `moved the work item on with that pass. Without it the validator would have refused.${sentence(data['instead'])}`;
    default:
      return entry.type;
  }
}

const statusName = (value: unknown, fallback: string): string => (typeof value === 'string' && value ? value : fallback);
const reasonOf = (value: unknown): string => (typeof value === 'string' && value ? `Reason: ${value}` : '');
const sentence = (value: unknown): string => (typeof value === 'string' && value ? ` ${value}` : '');

/** What the panel says while a pass holds. */
export function passLine(pass: { until: number; reason: string }, now: number): string {
  const minutes = Math.max(1, Math.ceil((pass.until - now) / 60_000));
  const left = minutes === 1 ? 'one more minute' : `${minutes} more minutes`;
  return `Someone who administers the project let this work item through for ${left}. Reason: ${pass.reason} It is still not proven.`;
}

/** What the panel says after the validator could not check this work item. */
export function uncheckedLine(unchecked: { at: number; reason: string; refused: boolean }, now: number, canLetThrough: boolean): string {
  const when = timeAgo(unchecked.at, now);
  const start = `${when.charAt(0).toUpperCase()}${when.slice(1)}:`;
  if (!unchecked.refused) return `${start} ${unchecked.reason} This project lets such a transition through, so check the proof below.`;
  const way = canLetThrough
    ? 'If it lasts, you can let this work item through below.'
    : 'If it lasts, someone who administers the project can let this work item through here.';
  return `${start} ${unchecked.reason} This project refuses a transition the app cannot check. Try the transition again. ${way}`;
}

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

/** What the panel says to the Proof Verifier when someone asks why a work item is blocked. */
export function blockedPrompt(issueKey: string): string {
  return `Explain what blocks ${issueKey} and write a repair brief for the coding agent.`;
}

/** Whether something went wrong that is worth explaining: evidence was turned away, or proof went stale. */
export function hasTrouble(view: Pick<ContractView, 'criteria'>): boolean {
  return view.criteria.some((criterion) => criterion.stale || criterion.state === 'rejected');
}

/** The line under a repair brief: what it is, and whether the pipeline has moved on since. */
export function briefNote(brief: { commit: string | null; outdated: boolean }, commit: string | null): string {
  const base = 'The coding agent gets this brief with the contract. It is advice and proves nothing. The verdicts stay with you.';
  if (!brief.outdated || !commit) return base;
  const from = brief.commit ? `at commit ${shortCommit(brief.commit)}` : 'before the pipeline reported';
  return `${base} It was written ${from}, and the pipeline has since reported ${shortCommit(commit)}, so it may no longer apply.`;
}

export function proofLine(proven: number, total: number): string {
  if (total === 0) return 'No criteria yet';
  return `${proven} of ${total} ${total === 1 ? 'criterion' : 'criteria'} proven`;
}
