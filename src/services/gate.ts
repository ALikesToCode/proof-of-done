import { errorLine } from '../core/errors';
import { gateDecision, summarize } from '../core/proof';
import { newId } from '../core/ids';
import { IssueInfo, JiraGateway } from '../jira/gateway';
import { ContractStore } from '../store/types';

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

export type GateAction = 'ignored' | 'duplicate' | 'reopened' | 'passed' | 'warned' | 'bounced';

export interface ValidatorResult {
  result: boolean;
  errorMessage?: string;
}

const PANEL_HINT = 'Add or review evidence in the Proof of Done panel.';

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
   */
  async validate(issueRef: string, actorAccountId: string | null = null): Promise<ValidatorResult> {
    const issue = await this.jira.getIssue(issueRef, 'app');
    // A work item the app cannot read is not one it can judge. Do not block it.
    if (!issue) return { result: true };
    const [bundle, settings] = await Promise.all([this.store.getBundle(issue.id), this.store.getSettings(issue.projectId)]);
    const summary = summarize(bundle.criteria, bundle.evidence, bundle.verdicts, settings.requireIndependent);
    const decision = gateDecision(bundle.contract ? summary : null, settings);
    if (decision.pass) return { result: true };
    try {
      const at = this.now();
      await this.store.insertEvent({
        id: newId(at),
        projectId: issue.projectId,
        issueId: issue.id,
        type: 'gate.blocked',
        at,
        actorAccountId,
        channel: 'jira',
        data: { reason: decision.reason, status: issue.statusName },
      });
    } catch (error) {
      // The answer is no by now. The caller lets a transition through when this method
      // throws, so an entry the store refuses must not turn the no into a yes.
      console.warn(`Proof of Done: could not record the refusal for ${issue.key}. ${errorLine(error)}`);
    }
    return { result: false, errorMessage: `Proof of Done: ${decision.reason} ${PANEL_HINT}` };
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
