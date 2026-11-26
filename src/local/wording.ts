/**
 * The services word their answers for Jira: they point at the issue panel and name the
 * Proof Verifier. Neither exists in the local adapter, so its answers pass through here
 * before a person or an agent reads them.
 */

const REPLACEMENTS: Array<[RegExp, string]> = [
  [/ in the Proof of Done panel/g, ' with the proof-of-done command'],
  [/ by a person or the Proof Verifier/g, ' by a person'],
  [/A person or the Proof Verifier (accepts|has)/g, 'A person $1'],
];

/** Lines that only make sense with Jira behind them. */
const JIRA_ONLY = /Teamwork Graph|\bJira\b|\bRovo\b/;

export function localText(text: string): string {
  let out = text;
  for (const [pattern, replacement] of REPLACEMENTS) out = out.replace(pattern, replacement);
  return out;
}

/** The same value with every string reworded, and list entries that only apply to Jira left out. */
export function localWording<T>(value: T): T {
  if (typeof value === 'string') return localText(value) as T;
  if (Array.isArray(value)) {
    return value.filter((entry) => !(typeof entry === 'string' && JIRA_ONLY.test(entry))).map((entry) => localWording(entry)) as T;
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) out[key] = localWording(entry);
    return out as T;
  }
  return value;
}
