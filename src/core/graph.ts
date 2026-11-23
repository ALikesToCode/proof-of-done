import { EvidenceDetails, EvidenceKind } from './types';

/**
 * What the Teamwork Graph links to a work item, and how a piece of evidence compares
 * with it. The graph holds the pull requests, builds and deployments that connected
 * tools reported to Jira for the work item, so it is a second source next to what
 * the evidence says about itself.
 *
 * A note is advice for whoever reviews the evidence. It never accepts or rejects.
 */

export type LinkedKind = 'pull_request' | 'build' | 'deployment';

/** The states the app tells apart. Anything else a tool reports reads as no state. */
export type LinkedState =
  | 'merged'
  | 'open'
  | 'draft'
  | 'declined'
  | 'successful'
  | 'failed'
  | 'in_progress'
  | 'pending'
  | 'cancelled'
  | 'rolled_back';

export interface LinkedItem {
  kind: LinkedKind;
  /** What the tool calls it, for example "#42 Fix the export". Text from outside Jira. */
  name: string;
  url: string | null;
  state: LinkedState | null;
  /** Where a deployment went, for example "production". */
  environment: string | null;
  /** The tool it came from, for example "GitHub". */
  provider: string | null;
  /** ISO 8601. */
  updatedAt: string | null;
}

export interface LinkedWork {
  items: LinkedItem[];
  /** The kinds the app may not have read in full: a page was cut, or that part gave no answer. */
  partial: LinkedKind[];
}

/**
 * `confirmed`: the graph links this very thing to the work item and agrees with the evidence.
 * `differs`: the graph links it, and holds a state that contradicts the evidence.
 * `not_linked`: the graph links others of its kind to the work item, and not this one.
 * `no_record`: the graph has nothing that settles it either way.
 */
export type GraphFinding = 'confirmed' | 'differs' | 'not_linked' | 'no_record';

export interface GraphNote {
  finding: GraphFinding;
  text: string;
}

const STATES: Record<string, LinkedState> = {
  merged: 'merged',
  open: 'open',
  draft: 'draft',
  declined: 'declined',
  successful: 'successful',
  success: 'successful',
  succeeded: 'successful',
  passed: 'successful',
  failed: 'failed',
  failure: 'failed',
  error: 'failed',
  in_progress: 'in_progress',
  running: 'in_progress',
  pending: 'pending',
  queued: 'pending',
  cancelled: 'cancelled',
  canceled: 'cancelled',
  rolled_back: 'rolled_back',
};

/**
 * Reads a state as a tool reported it. A build's state is free text in the graph, so
 * only the words listed above get through.
 */
export function toLinkedState(raw: unknown): LinkedState | null {
  if (typeof raw !== 'string') return null;
  const key = raw
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  return STATES[key] ?? null;
}

const STATE_WORDS: Record<LinkedState, string> = {
  merged: 'merged',
  open: 'open',
  draft: 'a draft',
  declined: 'declined',
  successful: 'successful',
  failed: 'failed',
  in_progress: 'in progress',
  pending: 'pending',
  cancelled: 'cancelled',
  rolled_back: 'rolled back',
};

const KIND_WORDS: Record<LinkedKind, { one: string; many: string }> = {
  pull_request: { one: 'pull request', many: 'pull requests' },
  build: { one: 'build', many: 'builds' },
  deployment: { one: 'deployment', many: 'deployments' },
};

/** The kinds in the graph that can stand behind each kind of evidence. */
const COUNTERPARTS: Partial<Record<EvidenceKind, LinkedKind[]>> = {
  pull_request: ['pull_request'],
  build: ['build', 'deployment'],
};

/** A name safe to put in a sentence: one short word, so that it cannot carry a sentence of its own. */
const PLAIN_NAME = /^[A-Za-z0-9][A-Za-z0-9_-]{0,23}$/;

/** A link reduced to what identifies the page: host and path, without case, query or trailing slash. */
function linkKey(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    const path = decodeURIComponent(parsed.pathname).replace(/\/+$/, '').toLowerCase();
    return path ? `${host}${path}` : null;
  } catch {
    return null;
  }
}

/** True when the evidence link is the graph's link, or a page under it such as a pull request's "files" tab. */
function sameLink(evidenceUrl: string, graphUrl: string | null): boolean {
  if (!graphUrl) return false;
  const mine = linkKey(evidenceUrl);
  const theirs = linkKey(graphUrl);
  return mine !== null && theirs !== null && (mine === theirs || mine.startsWith(`${theirs}/`));
}

type Checkable = { kind: EvidenceKind; url: string | null; details: EvidenceDetails };

/** Whether the graph can say anything about a piece of evidence: a pull request or a build with a link. */
export function graphCovers(evidence: Pick<Checkable, 'kind' | 'url'>): boolean {
  return COUNTERPARTS[evidence.kind] !== undefined && evidence.url !== null && linkKey(evidence.url) !== null;
}

function countPhrase(kinds: LinkedKind[], items: LinkedItem[]): string {
  return kinds
    .map((kind) => ({ kind, n: items.filter((item) => item.kind === kind).length }))
    .filter(({ n }) => n > 0)
    .map(({ kind, n }) => `${n} ${n === 1 ? KIND_WORDS[kind].one : KIND_WORDS[kind].many}`)
    .join(' and ');
}

function nonePhrase(kinds: LinkedKind[]): string {
  return `no ${kinds.map((kind) => KIND_WORDS[kind].one).join(' or ')}`;
}

function matched(evidence: Checkable, item: LinkedItem): GraphNote {
  const what = KIND_WORDS[item.kind].one;
  const linked = `The Teamwork Graph links this ${what} to the work item`;
  const where = item.kind === 'deployment' && item.environment && PLAIN_NAME.test(item.environment) ? ` in ${item.environment}` : '';
  const state = item.state;

  if (item.kind === 'pull_request') {
    if (state === 'merged') return { finding: 'confirmed', text: `${linked} and has it as merged.` };
    if (state === 'declined') return { finding: 'differs', text: `${linked}, but has it as declined.` };
    if (state === 'open' || state === 'draft') {
      return (evidence.details.status ?? '').toLowerCase() === 'merged'
        ? { finding: 'differs', text: `The evidence says this pull request is merged, but the Teamwork Graph has it as ${STATE_WORDS[state]}.` }
        : { finding: 'confirmed', text: `${linked} and has it as ${STATE_WORDS[state]}.` };
    }
    return { finding: 'confirmed', text: `${linked}. It holds no state for it.` };
  }

  if (state === 'successful') return { finding: 'confirmed', text: `${linked} and has it as successful${where}.` };
  if (state === 'failed' || state === 'cancelled' || state === 'rolled_back' || state === 'in_progress' || state === 'pending') {
    return { finding: 'differs', text: `${linked}, but has it as ${STATE_WORDS[state]}${where}.` };
  }
  return { finding: 'confirmed', text: `${linked}. It holds no state for it.` };
}

/**
 * Compares a piece of evidence with what the graph links to its work item.
 * Null when the graph has no say: the evidence is not a pull request or a build, or it has no link.
 */
export function compareWithGraph(evidence: Checkable, linked: LinkedWork): GraphNote | null {
  const kinds = COUNTERPARTS[evidence.kind];
  if (!kinds || !evidence.url || !graphCovers(evidence)) return null;
  const candidates = linked.items.filter((item) => kinds.includes(item.kind));
  const match = candidates.find((item) => sameLink(evidence.url as string, item.url));
  if (match) return matched(evidence, match);

  // A list the app did not read in full cannot show that something is missing from it.
  if (kinds.some((kind) => linked.partial.includes(kind))) {
    return { finding: 'no_record', text: 'The Teamwork Graph gave the app an incomplete list for this work item, and this link is not in the part it read.' };
  }
  if (candidates.length === 0) {
    const unconnected = linked.items.length === 0 ? ' That is expected when no development tool is connected to Jira.' : '';
    return {
      finding: 'no_record',
      text: `The Teamwork Graph shows ${nonePhrase(kinds)} linked to this work item, so it cannot confirm this one.${unconnected}`,
    };
  }
  return { finding: 'not_linked', text: `The Teamwork Graph links ${countPhrase(kinds, candidates)} to this work item, and this link is not one of them.` };
}
