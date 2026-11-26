import { PodError, errorLine } from '../core/errors';
import { PASS_MINUTES, gateDecision, summarize } from '../core/proof';
import { newId } from '../core/ids';
import { IssueInfo, JiraGateway } from '../jira/gateway';
import { ContractStore, EventRow } from '../store/types';

/** A status change of a work item, as far as Jira's event told us. */
export interface StatusChange {
  issueId: string;
  fromStatusId: string | null;
  fromStatusName: string | null;
  /** Category of the previous status, when the event carried it. */
  fromCategory: string | null;
  actorAccountId: string | null;
  /** Jira's id of this change. Tells duplicate deliveries of one change apart. */
  changeId: string | null;
  /** When Jira says the change happened, in epoch milliseconds. */
  occurredAt: number | null;
}

export type GateAction = 'ignored' | 'duplicate' | 'reopened' | 'passed' | 'warned' | 'bounced' | 'let_through';

export interface ValidatorResult {
  result: boolean;
  errorMessage?: string;
}

const PANEL_HINT = 'Add or review evidence in the Proof of Done panel.';

/** Why the validator could not check a work item. */
export type Unchecked = 'unreadable' | 'jira' | 'store';

const UNCHECKED: Record<Unchecked, (label: string) => string> = {
  unreadable: (label) => `The app may not read ${label}, so it could not check it.`,
  jira: (label) => `Jira did not answer the app, so it could not check ${label}.`,
  store: (label) => `The app's storage did not answer, so it could not check ${label}.`,
};

/** The end of a refusal in a project that chose to refuse what the app cannot check. */
export const REFUSES_BY_CHOICE =
  'This project refuses a transition the app cannot check. Try again in a minute. If it lasts, someone who administers the project can let this work item through from its Proof of Done panel.';
/** The end of a refusal when the app could not read what the project chose. */
export const REFUSES_BLIND =
  'It could not read what this project wants in that case either, so it refuses. Try again in a minute. If it lasts, a Jira admin can take the validator off this transition.';
/** What Jira shows when the validator itself broke. */
export const REFUSES_BROKEN =
  'Proof of Done: a fault in the app stopped it from checking this work item, so it refuses the transition. Try again in a minute. If it lasts, a Jira admin can take the validator off this transition.';

export const PASS_GRANTED = 'gate.pass_granted';
/** How far back in a work item's history the gate looks for a pass. */
const PASS_LOOKBACK = 50;

/** The newest pass on a work item that still holds at `at`, or null. */
export function activePass(events: EventRow[], at: number): EventRow | null {
  let newest: EventRow | null = null;
  for (const event of events) {
    if (event.type !== PASS_GRANTED) continue;
    const until = Number(event.data['until']);
    if (!Number.isFinite(until) || until <= at) continue;
    if (!newest || event.at > newest.at) newest = event;
  }
  return newest;
}

/** The comment the gate leaves on a work item that reached a done status without proof. */
export function doneWithoutProofComment(issueKey: string, statusName: string, reason: string): string[] {
  return [`${issueKey} is ${statusName}, but it is not proven. ${reason}`, PANEL_HINT];
}

/**
 * The done gate. It answers one question for a work item that is being closed: is
 * every criterion of its contract proven? What happens on a "no" is the project's
 * choice (`gateMode`): nothing, a comment, or moving the work item back.
 *
 * The event path reacts after the fact, because Jira delivers events with a delay of
 * seconds to minutes. The workflow validator path blocks the transition itself.
 */
export class GateService {
  private readonly now: () => number;

  constructor(
    private readonly store: ContractStore,
    private readonly jira: JiraGateway,
    now?: () => number,
  ) {
    this.now = now ?? (() => Date.now());
  }

  async onStatusChange(change: StatusChange): Promise<GateAction> {
    const issue = await this.jira.getIssue(change.issueId, 'app');
    if (!issue) return 'ignored';
    const isDone = issue.statusCategory === 'done';
    const fromCategory =
      change.fromCategory ?? (change.fromStatusId ? await this.jira.getStatusCategory(change.fromStatusId) : null);
    const wasDone = fromCategory === 'done';
    if (isDone === wasDone) return 'ignored';

    // Jira can deliver an event more than once. One status change gets one reaction.
    const marker = change.changeId ?? (change.occurredAt !== null ? `at-${change.occurredAt}` : null);
    if (marker !== null) {
      const recent = await this.store.listEvents(issue.id, 20);
      if (recent.some((e) => e.channel === 'jira' && e.data['change'] === marker)) return 'duplicate';
    }
    const base = { change: marker, changedAt: change.occurredAt, status: issue.statusName, fromStatus: change.fromStatusName };

    if (!isDone) {
      await this.record(issue, change, 'issue.reopened', base);
      return 'reopened';
    }

    const [bundle, settings] = await Promise.all([this.store.getBundle(issue.id), this.store.getSettings(issue.projectId)]);
    const summary = summarize(bundle.criteria, bundle.evidence, bundle.verdicts, settings.requireIndependent);
    const decision = gateDecision(bundle.contract ? summary : null, settings);
    const closed = { ...base, proven: summary.state === 'proven', contract: summary.total > 0, pass: decision.pass };

    if (decision.pass) {
      await this.record(issue, change, 'issue.done', closed);
      return 'passed';
    }

    // Someone who administers the project let it through. It is recorded as closed without proof and left where it is.
    const pass = activePass(await this.store.listEvents(issue.id, PASS_LOOKBACK), change.occurredAt ?? this.now());
    if (pass) {
      await this.record(issue, change, 'issue.done', { ...closed, letThrough: true, grantedBy: pass.actorAccountId, reason: pass.data['reason'] });
      return 'let_through';
    }

    if (settings.gateMode === 'bounce' && change.fromStatusId) {
      const backTo = await this.moveBack(issue, change.fromStatusId);
      if (backTo) {
        const commented = await this.comment(issue, [
          `Proof of Done moved ${issue.key} back to ${backTo}. ${decision.reason}`,
          `${PANEL_HINT} Then close it again.`,
        ]);
        await this.record(issue, change, 'gate.bounced', { ...base, reason: decision.reason, backTo, commented });
        return 'bounced';
      }
    }

    // The fact goes in before the comment, so a comment Jira refuses cannot lose it.
    await this.record(issue, change, 'issue.done', closed);
    const commented = await this.comment(issue, doneWithoutProofComment(issue.key, issue.statusName, decision.reason));
    await this.record(issue, change, 'gate.warned', {
      ...base,
      reason: decision.reason,
      commented,
      couldNotMoveBack: settings.gateMode === 'bounce',
    });
    return 'warned';
  }

  /**
   * The answer for the workflow validator. An admin adds the validator to a transition,
   * and from then on Jira refuses that transition while this returns false. A project
   * opts out by turning its gate off.
   *
   * `issueRef` is what Jira is asked about. `knownId` is the work item's id when the
   * request carried it, so the store can still be asked when Jira does not answer.
   *
   * This never throws for a fault it can name. When it could not check, the project's
   * `strictGate` setting decides, and when that could not be read either it refuses.
   */
  async validate(issueRef: string, actorAccountId: string | null = null, knownId: string | null = null): Promise<ValidatorResult> {
    let issue: IssueInfo | null = null;
    let why: Unchecked | null = null;
    try {
      issue = await this.jira.getIssue(issueRef, 'app');
      if (!issue) why = 'unreadable';
    } catch (error) {
      why = 'jira';
      console.error(`Proof of Done: the validator could not read ${issueRef} from Jira. ${errorLine(error)}`);
    }

    const issueId = issue?.id ?? knownId ?? (/^\d+$/.test(issueRef) ? issueRef : null);
    const label = issue?.key ?? issueRef;
    const readSettings = (projectId: string) => this.read(label, 'settings', () => this.store.getSettings(projectId));
    const [bundle, events, early] = issueId
      ? await Promise.all([
          this.read(label, 'contract', () => this.store.getBundle(issueId)),
          this.read(label, 'history', () => this.store.listEvents(issueId, PASS_LOOKBACK)),
          issue ? readSettings(issue.projectId) : null,
        ])
      : [null, null, null];
    // Without Jira, the contract still says which project the work item is in.
    const projectId = issue?.projectId ?? bundle?.contract?.projectId ?? null;
    const settings = issue ? early : projectId ? await readSettings(projectId) : null;
    if (issueId && (!bundle || (projectId && !settings))) why = why ?? 'store';

    if (settings?.gateMode === 'off') return { result: true };

    const refer = { issueId, projectId, label, actorAccountId, status: issue?.statusName ?? null };
    let reason: string;
    if (!why && issue && bundle && settings) {
      const summary = summarize(bundle.criteria, bundle.evidence, bundle.verdicts, settings.requireIndependent);
      const decision = gateDecision(bundle.contract ? summary : null, settings);
      if (decision.pass) return { result: true };
      reason = decision.reason;
    } else {
      why = why ?? 'store';
      reason = UNCHECKED[why](label);
    }

    // Someone who administers the project let this work item through, and said why.
    const pass = activePass(events ?? [], this.now());
    if (pass) {
      await this.note({ ...refer, projectId: projectId ?? pass.projectId }, 'gate.let_through', {
        grant: pass.id,
        grantedBy: pass.actorAccountId,
        reason: pass.data['reason'],
        instead: reason,
      });
      return { result: true };
    }

    if (!why) {
      await this.note(refer, 'gate.blocked', { reason });
      return { result: false, errorMessage: `Proof of Done: ${reason} ${PANEL_HINT}` };
    }

    if (settings && !settings.strictGate) {
      // No comment from here: Jira holds the work item while it asks, and a write to it
      // waits until the validator has timed out. The history and the log carry the record.
      await this.note(refer, 'gate.unchecked', { reason, why });
      console.warn(`Proof of Done: could not check ${label} (${why}) and let the transition through, as the project chose.`);
      return { result: true };
    }

    await this.note(refer, 'gate.blocked', { reason, why, unchecked: true });
    console.warn(`Proof of Done: could not check ${label} (${why}) and refused the transition.`);
    return { result: false, errorMessage: `Proof of Done: ${reason} ${settings ? REFUSES_BY_CHOICE : REFUSES_BLIND}` };
  }

  /**
   * Lets one work item through the done gate for a short while. Only someone who
   * administers the project may, and the reason stays in the history and on the work item.
   * The work item is not proven by this, and it goes on counting as closed without proof.
   */
  async letThrough(issueRef: string, actorAccountId: string | null, rawReason: unknown): Promise<void> {
    const issue = await this.jira.getIssue(issueRef, 'user');
    if (!issue) throw new PodError('not_found', 'This work item does not exist, or you do not have access to it.');
    if (!(await this.jira.canAdminister(issue.projectId))) {
      throw new PodError('forbidden', 'Only someone who administers the project can let a work item through the done gate.');
    }
    const reason = typeof rawReason === 'string' ? rawReason.replace(/\s+/g, ' ').trim().slice(0, 500) : '';
    if (reason.length < 10) throw new PodError('invalid', 'Say why, in at least 10 characters. The reason is kept in the history.');
    const settings = await this.store.getSettings(issue.projectId);
    if (settings.gateMode === 'off') throw new PodError('invalid', 'The done gate is off for this project, so nothing holds this work item.');
    const at = this.now();
    const until = at + PASS_MINUTES * 60_000;
    await this.store.insertEvent({
      id: newId(at),
      projectId: issue.projectId,
      issueId: issue.id,
      type: PASS_GRANTED,
      at,
      actorAccountId,
      channel: 'ui',
      data: { reason, until, status: issue.statusName },
    });
    await this.comment(issue, [
      `Someone who administers the project let ${issue.key} through the done gate for the next ${PASS_MINUTES} minutes. Reason: ${reason}`,
      'This proves nothing. The work item goes on counting as not proven until its criteria are.',
    ]);
  }

  /** Reads from the store. A read that fails is logged and comes back as null. */
  private async read<T>(label: string, what: string, load: () => Promise<T>): Promise<T | null> {
    try {
      return await load();
    } catch (error) {
      console.error(`Proof of Done: the validator could not read the ${what} of ${label}. ${errorLine(error)}`);
      return null;
    }
  }

  /**
   * Records what the validator answered. By now the answer is fixed, so an entry the
   * store refuses must not change it.
   */
  private async note(
    refer: { issueId: string | null; projectId: string | null; label: string; actorAccountId: string | null; status: string | null },
    type: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    if (!refer.issueId || !refer.projectId) return;
    try {
      const at = this.now();
      await this.store.insertEvent({
        id: newId(at),
        projectId: refer.projectId,
        issueId: refer.issueId,
        type,
        at,
        actorAccountId: refer.actorAccountId,
        channel: 'jira',
        data: { ...data, status: refer.status },
      });
    } catch (error) {
      console.warn(`Proof of Done: could not record ${type === 'gate.blocked' ? 'the refusal' : type} for ${refer.label}. ${errorLine(error)}`);
    }
  }

  /**
   * Moves the work item back to the status it came from, and only there: any other
   * status would be a guess. Returns the status name, or null when the workflow has
   * no such transition or Jira refuses it.
   */
  private async moveBack(issue: IssueInfo, statusId: string): Promise<string | null> {
    try {
      const back = (await this.jira.listTransitions(issue.id)).find((t) => t.toStatusId === statusId);
      if (!back) return null;
      await this.jira.transition(issue.id, back.id);
      return back.toStatusName;
    } catch (error) {
      console.warn(`Proof of Done: could not move ${issue.key} back. ${errorLine(error)}`);
      return null;
    }
  }

  /** Comments on the work item. A project can deny the app that right, and the gate must still record what it saw. */
  private async comment(issue: IssueInfo, paragraphs: string[]): Promise<boolean> {
    try {
      await this.jira.addComment(issue.id, paragraphs);
      return true;
    } catch (error) {
      console.warn(`Proof of Done: could not comment on ${issue.key}. ${errorLine(error)}`);
      return false;
    }
  }

  private record(issue: IssueInfo, change: StatusChange, type: string, data: Record<string, unknown>): Promise<void> {
    const at = this.now();
    return this.store.insertEvent({
      id: newId(at),
      projectId: issue.projectId,
      issueId: issue.id,
      type,
      at,
      actorAccountId: change.actorAccountId,
      channel: 'jira',
      data,
    });
  }
}
