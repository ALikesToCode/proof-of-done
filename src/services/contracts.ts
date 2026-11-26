import { checksPassed, isHttpUrl, runChecks, sanitizeDetails } from '../core/checks';
import { PodError } from '../core/errors';
import { extractCriteria } from '../core/extract';
import { newId } from '../core/ids';
import {
  attestationIndependent,
  criterionProof,
  evidenceStanding,
  failedNote,
  gateDecision,
  isIndependent,
  isStale,
  latestVerdict,
  pipelineCommit,
  pipelineResultFor,
  summarize,
} from '../core/proof';
import { rulesFor } from '../core/settings';
import {
  Criterion,
  Decision,
  Evidence,
  EvidenceKind,
  EVIDENCE_KINDS,
  ProjectSettings,
  ProofSummary,
  REQUIRED_KINDS,
  RequiredKind,
  Verdict,
  VerdictChannel,
} from '../core/types';
import { IssueInfo, JiraGateway } from '../jira/gateway';
import { ContractBundle, ContractStore } from '../store/types';
import { saveProof } from './proof-sync';
import {
  ContractView,
  CriterionInput,
  CriterionView,
  EvidenceInput,
  EvidenceView,
  HistoryEntry,
  Suggestion,
  VerdictInput,
} from './view';

export const MAX_CRITERIA = 40;
export const MAX_EVIDENCE_PER_CRITERION = 50;
const HISTORY_LIMIT = 100;
const ISSUE_REF = /^(?:\d{1,18}|[A-Za-z][A-Za-z0-9_]{0,63}-\d{1,12})$/;

/** Who is calling, and how the call reached the app. */
export interface Caller {
  /** The Atlassian account the call runs as. For an agent, the person who authorised it. */
  accountId: string | null;
  /** `ui` is a person in the issue panel, `agent` a coding agent's tool call, `verifier` the Proof Verifier agent. */
  via: 'ui' | 'agent' | 'verifier';
  /** The name an agent gave for itself. */
  agentName?: string | null;
}

interface Session {
  issue: IssueInfo;
  bundle: ContractBundle;
  settings: ProjectSettings;
  before: ProofSummary;
}

/**
 * Every change to a contract, its evidence or its verdicts goes through here, whether
 * it comes from the issue panel or from an agent's tool call. Jira decides what the
 * caller may see and edit. This class decides what counts as proof.
 */
export class ContractService {
  private readonly now: () => number;

  constructor(
    private readonly store: ContractStore,
    private readonly jira: JiraGateway,
    now?: () => number,
  ) {
    this.now = now ?? (() => Date.now());
  }

  async view(issueRef: string, caller: Caller): Promise<ContractView> {
    const issue = await this.issue(issueRef);
    const [bundle, settings, canEdit] = await Promise.all([
      this.store.getBundle(issue.id),
      this.store.getSettings(issue.projectId),
      this.jira.canEdit(issue.id),
    ]);
    return buildView(issue, bundle, settings, caller, canEdit);
  }

  /**
   * Starts the contract of a work item. With `withSuggestions` it is filled from the
   * criteria in the description and the project's rules. An agent may start a contract
   * only that way, so the ticket decides what the contract says, never the agent.
   */
  async createContract(issueRef: string, caller: Caller, options: { withSuggestions: boolean }): Promise<ContractView> {
    const session = await this.open(issueRef);
    const { issue, bundle, settings } = session;
    if (bundle.contract) throw new PodError('conflict', 'This work item already has a done contract.');
    const suggestions = options.withSuggestions ? suggest(issue, settings, []) : [];
    if (caller.via !== 'ui' && suggestions.length === 0) {
      throw new PodError(
        'invalid',
        'No acceptance criteria were found in the description or the project rules. A person has to write this contract.',
      );
    }
    await this.startContract(issue, caller, suggestions);
    return this.close(session, caller);
  }

  async addCriteria(issueRef: string, caller: Caller, inputs: CriterionInput[]): Promise<ContractView> {
    onlyPeople(caller);
    const session = await this.open(issueRef);
    const { issue, bundle } = session;
    if (!Array.isArray(inputs) || inputs.length === 0) throw new PodError('invalid', 'Write the criterion to add.');
    const active = bundle.criteria.filter((c) => c.active);
    const taken = new Set(active.map((c) => textKey(c.text)));
    const additions: Suggestion[] = [];
    for (const input of inputs) {
      const text = cleanCriterion(input?.text);
      if (taken.has(textKey(text))) throw new PodError('conflict', `"${text}" is already in the contract.`);
      taken.add(textKey(text));
      additions.push({ text, requiredKind: toRequiredKind(input?.requiredKind), source: 'manual', sourceRef: null });
    }
    roomFor(active.length, additions.length);
    if (!bundle.contract) await this.startContract(issue, caller, []);
    await this.append(issue, caller, bundle.criteria, additions);
    return this.close(session, caller);
  }

  /** Adds the criteria found in the description or the project rules that the contract lacks. */
  async addSuggested(issueRef: string, caller: Caller): Promise<ContractView> {
    onlyPeople(caller);
    const session = await this.open(issueRef);
    const { issue, bundle, settings } = session;
    const suggestions = suggest(issue, settings, bundle.criteria);
    if (suggestions.length === 0) {
      throw new PodError('invalid', 'Every criterion found in the description is already in the contract.');
    }
    roomFor(bundle.criteria.filter((c) => c.active).length, suggestions.length);
    if (!bundle.contract) await this.startContract(issue, caller, suggestions);
    else await this.append(issue, caller, bundle.criteria, suggestions);
    return this.close(session, caller);
  }

  /**
   * Changes the wording or the required evidence of a criterion. The old version is
   * retired with its evidence and a new one takes its place, so proof given for one
   * wording can never be read as proof of another.
   */
  async replaceCriterion(issueRef: string, caller: Caller, criterionId: string, input: CriterionInput): Promise<ContractView> {
    onlyPeople(caller);
    const session = await this.open(issueRef);
    const { issue, bundle } = session;
    const current = activeCriterion(bundle, criterionId);
    const text = cleanCriterion(input?.text);
    const requiredKind = toRequiredKind(input?.requiredKind);
    if (text === current.text && requiredKind === current.requiredKind) return this.close(session, caller);
    const clash = bundle.criteria.find((c) => c.active && c.id !== current.id && textKey(c.text) === textKey(text));
    if (clash) throw new PodError('conflict', `"${text}" is already in the contract.`);
    const now = this.now();
    const sameText = text === current.text;
    const replacement: Criterion = {
      id: newId(now),
      issueId: issue.id,
      position: current.position,
      text,
      source: sameText ? current.source : 'manual',
      sourceRef: sameText ? current.sourceRef : null,
      requiredKind,
      active: true,
      createdBy: caller.accountId,
      createdAt: now,
    };
    // Insert before retiring the old one. If the second step fails the contract has a
    // spare criterion a person can remove, which beats silently losing one.
    await this.store.insertCriteria([replacement]);
    await this.store.deactivateCriterion(current.id, issue.id);
    await this.record(issue, caller, 'criterion.replaced', {
      criterionId: replacement.id,
      replaced: current.id,
      text,
      previousText: current.text,
      requiredKind,
      previousKind: current.requiredKind,
    });
    return this.close(session, caller);
  }

  async removeCriterion(issueRef: string, caller: Caller, criterionId: string): Promise<ContractView> {
    onlyPeople(caller);
    const session = await this.open(issueRef);
    const { issue, bundle } = session;
    const current = activeCriterion(bundle, criterionId);
    await this.store.deactivateCriterion(current.id, issue.id);
    await this.record(issue, caller, 'criterion.removed', { criterionId: current.id, text: current.text });
    return this.close(session, caller);
  }

  /**
   * Records a piece of evidence against one criterion and runs the mechanical checks
   * on it. Evidence that fails a check is stored too, so the history shows what was
   * tried, but it can never be accepted.
   */
  async submitEvidence(issueRef: string, caller: Caller, input: EvidenceInput): Promise<ContractView> {
    return (await this.addEvidence(issueRef, caller, input)).view;
  }

  /** Records a piece of evidence and says which one it was, so a tool call can report on exactly that one. */
  async addEvidence(issueRef: string, caller: Caller, input: EvidenceInput): Promise<{ view: ContractView; evidenceId: string }> {
    if (caller.via === 'verifier') throw new PodError('forbidden', 'The verifier checks evidence. It does not submit any.');
    const session = await this.open(issueRef);
    const { issue, bundle } = session;
    if (!bundle.contract) throw new PodError('invalid', 'This work item has no done contract yet, so there is nothing to prove.');
    const criterion = activeCriterion(bundle, input?.criterionId);
    const kind = toEvidenceKind(input?.kind);
    const summary = squash(input?.summary);
    if (summary.length > 1000) {
      throw new PodError('invalid', 'The summary can be 1,000 characters at most. Put longer output in the excerpt, or link to it.');
    }
    const url = squash(input?.url) || null;
    if (url && url.length > 2000) throw new PodError('invalid', 'The link can be 2,000 characters at most.');
    const details = sanitizeDetails(input?.details);

    const own = bundle.evidence.filter((e) => e.criterionId === criterion.id);
    if (own.length >= MAX_EVIDENCE_PER_CRITERION) {
      throw new PodError('invalid', `This criterion already has ${MAX_EVIDENCE_PER_CRITERION} pieces of evidence.`);
    }
    const detailsKey = JSON.stringify(details);
    if (own.some((e) => e.kind === kind && e.summary === summary && e.url === url && JSON.stringify(e.details) === detailsKey)) {
      throw new PodError('conflict', 'The same evidence is already recorded for this criterion.');
    }

    const channel = caller.via;
    const otherUrls = bundle.evidence.flatMap((e) => (e.criterionId !== criterion.id && e.url ? [e.url] : []));
    // The pipeline's word on a commit stands against anyone else's word on the same commit.
    const reported = kind === 'test_run' || kind === 'build' ? pipelineResultFor(bundle.evidence, criterion.id, kind, details.commit) : null;
    const checks = runChecks({
      requiredKind: criterion.requiredKind,
      kind,
      summary,
      url,
      details,
      channel,
      otherUrls,
      pipelineOnly: session.settings.pipelineOnly,
      pipelineSays: reported && !reported.checksPassed ? failedNote(reported) : null,
    });
    const now = this.now();
    const evidence: Evidence = {
      id: newId(now),
      criterionId: criterion.id,
      issueId: issue.id,
      kind,
      summary,
      url,
      details,
      channel,
      actorAccountId: caller.accountId,
      agentName: channel === 'agent' ? squash(caller.agentName).slice(0, 128) || null : null,
      checks,
      checksPassed: checksPassed(checks),
      createdAt: now,
    };
    await this.store.insertEvidence(evidence, issue.projectId);
    await this.record(issue, caller, 'evidence.submitted', {
      evidenceId: evidence.id,
      criterionId: criterion.id,
      text: criterion.text,
      kind,
      checksPassed: evidence.checksPassed,
      agentName: evidence.agentName,
    });

    if (kind === 'attestation' && evidence.checksPassed) {
      const independent = attestationIndependent(caller.accountId, issue.assigneeAccountId);
      await this.saveVerdict(issue, caller, criterion, evidence, {
        decision: 'accepted',
        reason: independent
          ? 'Attested by a person who is not the assignee of this work item.'
          : 'Attested by the assignee of this work item.',
        channel: 'attestation',
        independent,
      });
    }
    return { view: await this.close(session, caller), evidenceId: evidence.id };
  }

  /** Accepts or rejects a piece of evidence. Only a person or the verifier can. */
  async recordVerdict(issueRef: string, caller: Caller, input: VerdictInput): Promise<ContractView> {
    if (caller.via === 'agent') {
      throw new PodError('forbidden', 'The agent that did the work cannot judge its own evidence. A person or the Proof Verifier has to.');
    }
    const session = await this.open(issueRef);
    const { issue, bundle, settings } = session;
    const evidence = bundle.evidence.find((e) => e.id === input?.evidenceId);
    if (!evidence) throw new PodError('not_found', 'That evidence does not belong to this work item.');
    const criterion = activeCriterion(bundle, evidence.criterionId);
    if (!evidence.checksPassed) {
      throw new PodError('invalid', 'This evidence failed its checks, so there is nothing to review. Submit corrected evidence instead.');
    }
    if (isStale(evidence, pipelineCommit(bundle.evidence))) {
      throw new PodError('invalid', 'This evidence is about an earlier commit, so there is nothing to review. The work needs evidence for the commit it is at now.');
    }
    const decision = toDecision(input?.decision);
    const reason = squash(input?.reason);
    if (reason.length > 2000) throw new PodError('invalid', 'The reason can be 2,000 characters at most.');
    if (decision === 'rejected' && reason.length < 3) {
      throw new PodError('invalid', 'Say why this evidence does not prove the criterion.');
    }
    if (caller.via === 'verifier' && reason.length < 10) {
      throw new PodError('invalid', 'Give the reasoning behind the verdict in a sentence or two.');
    }
    const channel: VerdictChannel = caller.via === 'verifier' ? 'verifier' : 'ui';
    const independent = isIndependent(evidence, { channel, actorAccountId: caller.accountId });
    if (decision === 'accepted' && !independent && settings.requireIndependent) {
      throw new PodError('forbidden', 'You added this evidence, so someone else has to accept it. This project requires an independent check.');
    }
    const standing = latestVerdict(evidence.id, bundle.verdicts);
    if (standing && standing.decision === decision && (decision === 'rejected' || standing.independent || !independent)) {
      throw new PodError('conflict', `This evidence is already ${decision}.`);
    }
    await this.saveVerdict(issue, caller, criterion, evidence, {
      decision,
      reason: reason || 'Accepted.',
      channel,
      independent,
    });
    return this.close(session, caller);
  }

  async history(issueRef: string): Promise<HistoryEntry[]> {
    const issue = await this.issue(issueRef);
    const events = await this.store.listEvents(issue.id, HISTORY_LIMIT);
    return events.map((e) => ({ id: e.id, type: e.type, at: e.at, actorAccountId: e.actorAccountId, channel: e.channel, data: e.data }));
  }

  private async issue(issueRef: string): Promise<IssueInfo> {
    const ref = typeof issueRef === 'string' ? issueRef.trim() : '';
    if (!ISSUE_REF.test(ref)) throw new PodError('invalid', 'Give the work item key, for example ABC-123.');
    const issue = await this.jira.getIssue(ref, 'user');
    if (!issue) throw new PodError('not_found', `Work item ${ref} does not exist, or you do not have access to it.`);
    return issue;
  }

  private async open(issueRef: string): Promise<Session> {
    const issue = await this.issue(issueRef);
    const [bundle, settings, canEdit] = await Promise.all([
      this.store.getBundle(issue.id),
      this.store.getSettings(issue.projectId),
      this.jira.canEdit(issue.id),
    ]);
    if (!canEdit) {
      throw new PodError('forbidden', `You need permission to edit ${issue.key} to change its done contract or its proof.`);
    }
    return { issue, bundle, settings, before: summarize(bundle.criteria, bundle.evidence, bundle.verdicts, settings.requireIndependent) };
  }

  /** Re-reads the rows, so the stored summary also covers changes made by others meanwhile. */
  private async close(session: Session, caller: Caller): Promise<ContractView> {
    const { issue, settings, before } = session;
    const bundle = await this.store.getBundle(issue.id);
    const summary = summarize(bundle.criteria, bundle.evidence, bundle.verdicts, settings.requireIndependent);
    if (before.state !== 'proven' && summary.state === 'proven') {
      await this.record(issue, caller, 'proof.completed', { total: summary.total });
    } else if (before.state === 'proven' && summary.state !== 'proven') {
      await this.record(issue, caller, 'proof.reopened', { proven: summary.proven, total: summary.total });
    }
    await saveProof(this.store, this.jira, issue, summary, this.now());
    return buildView(issue, bundle, settings, caller, true);
  }

  private async startContract(issue: IssueInfo, caller: Caller, suggestions: Suggestion[]): Promise<void> {
    const now = this.now();
    const created = await this.store.createContract({
      issueId: issue.id,
      issueKey: issue.key,
      projectId: issue.projectId,
      createdBy: caller.accountId,
      createdAt: now,
      updatedAt: now,
    });
    if (!created) throw new PodError('conflict', 'Someone created this contract a moment ago. Reload to see it.');
    const criteria = suggestions.map((s, index) => toCriterion(issue, caller, s, index, now));
    await this.store.insertCriteria(criteria);
    await this.record(issue, caller, 'contract.created', {
      criteria: criteria.length,
      fromDescription: criteria.filter((c) => c.source === 'description').length,
      fromRules: criteria.filter((c) => c.source === 'project_rule').length,
    });
  }

  private async append(issue: IssueInfo, caller: Caller, existing: Criterion[], additions: Suggestion[]): Promise<void> {
    const now = this.now();
    let position = existing.reduce((max, c) => Math.max(max, c.position), -1) + 1;
    const criteria = additions.map((s) => toCriterion(issue, caller, s, position++, now));
    await this.store.insertCriteria(criteria);
    for (const c of criteria) {
      await this.record(issue, caller, 'criterion.added', {
        criterionId: c.id,
        text: c.text,
        source: c.source,
        requiredKind: c.requiredKind,
      });
    }
  }

  private async saveVerdict(
    issue: IssueInfo,
    caller: Caller,
    criterion: Criterion,
    evidence: Evidence,
    decided: { decision: Decision; reason: string; channel: VerdictChannel; independent: boolean },
  ): Promise<void> {
    const now = this.now();
    const verdict: Verdict = {
      id: newId(now),
      evidenceId: evidence.id,
      criterionId: criterion.id,
      issueId: issue.id,
      decision: decided.decision,
      reason: decided.reason,
      channel: decided.channel,
      actorAccountId: caller.accountId,
      independent: decided.independent,
      createdAt: now,
    };
    await this.store.insertVerdict(verdict, issue.projectId);
    await this.record(issue, caller, 'verdict.recorded', {
      evidenceId: evidence.id,
      criterionId: criterion.id,
      text: criterion.text,
      decision: verdict.decision,
      by: verdict.channel,
      independent: verdict.independent,
      reason: verdict.reason,
    });
  }

  private record(issue: IssueInfo, caller: Caller, type: string, data: Record<string, unknown>): Promise<void> {
    const at = this.now();
    return this.store.insertEvent({
      id: newId(at),
      projectId: issue.projectId,
      issueId: issue.id,
      type,
      at,
      actorAccountId: caller.accountId,
      channel: caller.via,
      data,
    });
  }
}

/** Builds what a caller sees. `canEdit` is Jira's answer for this caller. */
export function buildView(
  issue: IssueInfo,
  bundle: ContractBundle,
  settings: ProjectSettings,
  caller: Caller,
  canEdit: boolean,
): ContractView {
  const exists = bundle.contract !== null;
  const summary = summarize(bundle.criteria, bundle.evidence, bundle.verdicts, settings.requireIndependent);
  const mayReview = canEdit && caller.via !== 'agent';
  const commit = pipelineCommit(bundle.evidence);
  const criteria: CriterionView[] = bundle.criteria
    .filter((c) => c.active)
    .map((criterion) => {
      const proof = criterionProof(criterion.id, bundle.evidence, bundle.verdicts, settings.requireIndependent);
      const evidence = bundle.evidence
        .filter((e) => e.criterionId === criterion.id)
        .sort((a, b) => b.createdAt - a.createdAt || (a.id < b.id ? 1 : -1))
        .map((e) => toEvidenceView(e, bundle.verdicts, settings, caller, mayReview, commit));
      return {
        id: criterion.id,
        text: criterion.text,
        source: criterion.source,
        sourceRef: criterion.sourceRef,
        requiredKind: criterion.requiredKind,
        state: proof.state,
        selfReviewed: proof.selfReviewed,
        needsIndependent: proof.needsIndependent,
        stale: proof.stale,
        evidence,
      };
    });
  return {
    issue: {
      id: issue.id,
      key: issue.key,
      summary: issue.summary,
      issueType: issue.issueType,
      statusName: issue.statusName,
      statusCategory: issue.statusCategory,
      projectId: issue.projectId,
      assigneeAccountId: issue.assigneeAccountId,
    },
    exists,
    createdAt: bundle.contract?.createdAt ?? null,
    createdBy: bundle.contract?.createdBy ?? null,
    summary,
    gate: gateDecision(exists ? summary : null, settings),
    policy: { requireIndependent: settings.requireIndependent, gateMode: settings.gateMode, pipelineOnly: settings.pipelineOnly },
    commit,
    criteria,
    suggestions: suggest(issue, settings, bundle.criteria).slice(0, Math.max(0, MAX_CRITERIA - criteria.length)),
    canEdit,
    viewerAccountId: caller.accountId,
  };
}

function toEvidenceView(
  evidence: Evidence,
  verdicts: Verdict[],
  settings: ProjectSettings,
  caller: Caller,
  mayReview: boolean,
  commit: string | null,
): EvidenceView {
  const standing = evidenceStanding(evidence, verdicts, commit);
  const verdict = latestVerdict(evidence.id, verdicts);
  const channel: VerdictChannel = caller.via === 'verifier' ? 'verifier' : 'ui';
  const independent = isIndependent(evidence, { channel, actorAccountId: caller.accountId });
  const open = standing === 'pending' || standing === 'rejected' || standing === 'self_accepted';
  // A self-review that already stands gains nothing from being repeated.
  const allowed = independent || (!settings.requireIndependent && standing !== 'self_accepted');
  return {
    id: evidence.id,
    kind: evidence.kind,
    summary: evidence.summary,
    // The stored row keeps a link that failed its check. Only an http or https address
    // leaves here, so no page and no tool can show anything else as a link.
    url: evidence.url && isHttpUrl(evidence.url) ? evidence.url : null,
    details: evidence.details,
    channel: evidence.channel,
    actorAccountId: evidence.actorAccountId,
    agentName: evidence.agentName,
    checks: evidence.checks,
    standing,
    verdict: verdict
      ? {
          decision: verdict.decision,
          reason: verdict.reason,
          channel: verdict.channel,
          actorAccountId: verdict.actorAccountId,
          independent: verdict.independent,
          createdAt: verdict.createdAt,
        }
      : null,
    createdAt: evidence.createdAt,
    canAccept: mayReview && open && allowed,
    canReject: mayReview && (standing === 'pending' || standing === 'accepted' || standing === 'self_accepted'),
    acceptBlocked:
      mayReview && open && !independent && settings.requireIndependent
        ? "You added this evidence, so someone else has to accept it. A project admin can turn that rule off for a team of one, in the project's Proof of Done settings."
        : null,
  };
}

/** Criteria the description and the project rules call for that are not in `existing`. */
export function suggest(issue: IssueInfo, settings: ProjectSettings, existing: Criterion[]): Suggestion[] {
  // Retired criteria count as taken: a person removed them on purpose.
  const taken = new Set(existing.map((c) => textKey(c.text)));
  const out: Suggestion[] = [];
  const offer = (suggestion: Suggestion) => {
    const key = textKey(suggestion.text);
    if (taken.has(key) || out.length >= MAX_CRITERIA) return;
    taken.add(key);
    out.push(suggestion);
  };
  for (const found of extractCriteria(issue.description)) {
    offer({ text: found.text, requiredKind: 'any', source: 'description', sourceRef: found.anchor });
  }
  for (const rule of rulesFor(settings, issue.issueType)) {
    offer({ text: rule.text, requiredKind: rule.requiredKind, source: 'project_rule', sourceRef: rule.id });
  }
  return out;
}

function toCriterion(issue: IssueInfo, caller: Caller, suggestion: Suggestion, position: number, now: number): Criterion {
  return {
    id: newId(now),
    issueId: issue.id,
    position,
    text: suggestion.text,
    source: suggestion.source,
    sourceRef: suggestion.sourceRef ? suggestion.sourceRef.slice(0, 255) : null,
    requiredKind: suggestion.requiredKind,
    active: true,
    createdBy: caller.accountId,
    createdAt: now,
  };
}

function activeCriterion(bundle: ContractBundle, criterionId: unknown): Criterion {
  const criterion = bundle.criteria.find((c) => c.id === criterionId);
  if (!criterion) throw new PodError('not_found', "That criterion is not part of this work item's contract.");
  if (!criterion.active) throw new PodError('invalid', 'That criterion was removed from the contract or replaced by a newer version.');
  return criterion;
}

function onlyPeople(caller: Caller): void {
  if (caller.via !== 'ui') throw new PodError('forbidden', 'Only a person can change what a done contract says.');
}

function roomFor(active: number, adding: number): void {
  if (active + adding > MAX_CRITERIA) {
    throw new PodError('invalid', `A contract can hold ${MAX_CRITERIA} criteria. This one has ${active}.`);
  }
}

function squash(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function textKey(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase();
}

function cleanCriterion(raw: unknown): string {
  const text = squash(raw);
  if (text.length < 3) throw new PodError('invalid', 'A criterion needs at least 3 characters.');
  if (text.length > 500) throw new PodError('invalid', 'A criterion can be 500 characters at most. Split it into smaller ones.');
  return text;
}

function toRequiredKind(raw: unknown): RequiredKind {
  if (raw === undefined || raw === null || raw === '') return 'any';
  if (REQUIRED_KINDS.includes(raw as RequiredKind)) return raw as RequiredKind;
  throw new PodError('invalid', `Unknown evidence kind "${String(raw)}". Use one of: ${REQUIRED_KINDS.join(', ')}.`);
}

function toEvidenceKind(raw: unknown): EvidenceKind {
  if (EVIDENCE_KINDS.includes(raw as EvidenceKind)) return raw as EvidenceKind;
  throw new PodError('invalid', `Unknown evidence kind "${String(raw)}". Use one of: ${EVIDENCE_KINDS.join(', ')}.`);
}

function toDecision(raw: unknown): Decision {
  if (raw === 'accepted' || raw === 'rejected') return raw;
  throw new PodError('invalid', 'A verdict is either "accepted" or "rejected".');
}
