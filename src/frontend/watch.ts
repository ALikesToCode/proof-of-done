/**
 * Remembers until when the panel looks for the Proof Verifier's verdicts on a work item.
 *
 * Jira draws the panel again when Rovo chat opens beside the work item, and a panel that
 * was just drawn has nothing in memory. The browser's session storage outlives that and
 * ends with the tab. Where the browser keeps storage from the app, the panel only looks
 * until Jira draws it again. No Forge imports, so it can be unit-tested.
 */

const key = (issueKey: string): string => `proof-of-done.watch.${issueKey}`;

function storage(): Storage | null {
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
}

/** Notes that the panel looks for verdicts on this work item until `until`, in milliseconds since 1970. */
export function rememberWatch(issueKey: string, until: number): void {
  try {
    storage()?.setItem(key(issueKey), String(until));
  } catch {
    // A full or blocked storage costs the watch its memory and nothing else.
  }
}

export function forgetWatch(issueKey: string): void {
  try {
    storage()?.removeItem(key(issueKey));
  } catch {
    // Nothing to forget where nothing could be stored.
  }
}

/** Until when the panel should still look for verdicts on this work item, or 0 when it should not. */
export function recallWatch(issueKey: string, now: number): number {
  try {
    const until = Number(storage()?.getItem(key(issueKey)));
    return Number.isFinite(until) && until > now ? until : 0;
  } catch {
    return 0;
  }
}
