/**
 * The project meter. It answers one question: is the project converging, or is the
 * team only busy?
 *
 * Work arrives when a work item is opened or reopened. Work leaves only when a work
 * item is closed with every criterion of its contract proven. A work item closed
 * without proof is activity. It does not move the meter.
 */

export type MeterVerdict = 'climbing' | 'busy' | 'stalled';

export const METER_WINDOWS = [7, 14, 30] as const;
export const DEFAULT_WINDOW = 7;

export interface MeterCounts {
  windowDays: number;
  /** Work items created in the window. */
  opened: number;
  /** Work items that left a done status in the window. */
  reopened: number;
  /** Work items that are in a done status now and reached it in the window. */
  closed: number;
  /** Of the closed ones, those whose contract is fully proven. */
  closedProven: number;
  /** Of the closed ones, those with a contract that is not fully proven. */
  closedUnproven: number;
  /** Pieces of evidence submitted in the window. */
  evidence: number;
  /** Verdicts recorded in the window. */
  verdicts: number;
}

export interface Meter extends MeterCounts {
  /** Closed in the window with no contract at all. */
  closedNoContract: number;
  verdict: MeterVerdict;
  /** Why, in a sentence or two. */
  reason: string;
}

export function toWindowDays(raw: unknown): number {
  const value = Number(raw);
  return (METER_WINDOWS as readonly number[]).includes(value) ? value : DEFAULT_WINDOW;
}

const count = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

export function readMeter(counts: MeterCounts): Meter {
  const whole = (n: number): number => (Number.isFinite(n) && n > 0 ? Math.floor(n) : 0);
  const c: MeterCounts = {
    windowDays: counts.windowDays,
    opened: whole(counts.opened),
    reopened: whole(counts.reopened),
    closed: whole(counts.closed),
    closedProven: whole(counts.closedProven),
    closedUnproven: whole(counts.closedUnproven),
    evidence: whole(counts.evidence),
    verdicts: whole(counts.verdicts),
  };
  // The total comes from Jira and the split from the app's store, a moment apart.
  // Never let the two disagree on screen.
  c.closed = Math.max(c.closed, c.closedProven + c.closedUnproven);
  const closedNoContract = c.closed - c.closedProven - c.closedUnproven;
  const arrived = c.opened + c.reopened;
  const withoutProof = c.closedUnproven + closedNoContract;
  const active = arrived + c.closed + c.evidence + c.verdicts > 0;

  let verdict: MeterVerdict;
  let reason: string;
  if (c.closedProven > arrived) {
    verdict = 'climbing';
    reason = `${count(c.closedProven, 'work item was', 'work items were')} closed with proof, against ${arrived} opened or reopened.`;
  } else if (active) {
    verdict = 'busy';
    reason = `${count(c.closedProven, 'work item was', 'work items were')} closed with proof, against ${arrived} opened or reopened.`;
    if (withoutProof > 0) {
      reason += ` ${count(withoutProof, 'more was', 'more were')} closed without proof, and ${withoutProof === 1 ? 'that does' : 'those do'} not count.`;
    }
  } else {
    verdict = 'stalled';
    reason = `Nothing was opened, closed or proven in the last ${c.windowDays} days.`;
  }
  return { ...c, closedNoContract, verdict, reason };
}
