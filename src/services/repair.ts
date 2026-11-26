import { PodError } from '../core/errors';
import { EventRow } from '../store/types';

/**
 * The repair brief: what the Proof Verifier tells the coding agent to fix, written from
 * the records of one work item. It is advice. It proves nothing and changes no verdict.
 * It is kept as an event, so the history shows every brief that was written or removed.
 */

export const BRIEF_WRITTEN = 'brief.written';
export const BRIEF_REMOVED = 'brief.removed';
export const BRIEF_MIN = 40;
export const BRIEF_MAX = 2000;

/** Control characters other than a line break and a tab. */
const CONTROL = /[\u0000-\u0008\u000b-\u001f\u007f]/g;

export function cleanBrief(raw: unknown): string {
  const text =
    typeof raw === 'string'
      ? raw
          .replace(/\r\n?/g, '\n')
          .replace(CONTROL, '')
          .replace(/[ \t]+\n/g, '\n')
          .replace(/\n{3,}/g, '\n\n')
          .trim()
      : '';
  if (text.length < BRIEF_MIN) {
    throw new PodError(
      'invalid',
      `Write the repair brief first: what to fix, and what evidence would then prove each open criterion, in at least ${BRIEF_MIN} characters.`,
    );
  }
  if (text.length > BRIEF_MAX) {
    throw new PodError('invalid', `A repair brief has at most 2,000 characters. This one has ${text.length}. Shorten it.`);
  }
  return text;
}

/** The brief that stands: the newest one written, unless someone removed it afterwards. */
export function currentBrief(events: EventRow[]): EventRow | null {
  let newest: EventRow | null = null;
  for (const event of events) {
    if (event.type !== BRIEF_WRITTEN && event.type !== BRIEF_REMOVED) continue;
    if (!newest || event.at > newest.at || (event.at === newest.at && event.id > newest.id)) newest = event;
  }
  return newest && newest.type === BRIEF_WRITTEN && typeof newest.data['text'] === 'string' ? newest : null;
}
