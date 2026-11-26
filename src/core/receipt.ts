import { sanitizeDetails } from './checks';
import { EvidenceDetails } from './types';

/**
 * A pipeline receipt: what a project's CI says about one commit, sent with the
 * project's key. It is the one kind of evidence that the worker cannot write, because
 * the worker does not hold the key.
 */

export type ReceiptKind = 'test_run' | 'build';

export interface Receipt {
  /** The work items it is about, upper-cased, at most `MAX_KEYS`. */
  issueKeys: string[];
  kind: ReceiptKind;
  summary: string;
  url: string | null;
  /** Always has a commit. */
  details: EvidenceDetails & { commit: string };
}

export const MAX_KEYS = 5;
export const MAX_RECEIPT_BYTES = 20_000;

const ISSUE_KEY = /(?<![A-Za-z0-9_])([A-Za-z][A-Za-z0-9_]{1,63}-\d{1,12})(?![A-Za-z0-9_])/g;
const COMMIT = /^[0-9a-f]{7,64}$/;

/** The work item keys named in a branch name, a commit message or a pull request title. */
export function issueKeysIn(text: string): string[] {
  const found: string[] = [];
  for (const match of text.matchAll(ISSUE_KEY)) {
    const key = (match[1] ?? '').toUpperCase();
    if (key && !found.includes(key)) found.push(key);
  }
  return found;
}

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : '');

/**
 * Reads the body a pipeline sent. Returns the reason as a string when it cannot be a receipt.
 *
 * Fields: `issue` (a key) or `ref` (any text that names keys, such as a branch name),
 * `commit`, and either `passed` and `failed` for a test run or `status` for a build.
 * Optional: `kind`, `skipped`, `exitCode`, `command`, `branch`, `repository`, `workflow`,
 * `run`, `url`, `summary`.
 */
export function parseReceipt(body: string): Receipt | string {
  if (typeof body !== 'string' || body.length === 0) return 'The body is empty.';
  if (body.length > MAX_RECEIPT_BYTES) return 'The body is too long.';
  let raw: unknown;
  try {
    raw = JSON.parse(body);
  } catch {
    return 'The body is not JSON.';
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return 'The body is not a JSON object.';
  const source = raw as Record<string, unknown>;

  const issueKeys = issueKeysIn(`${text(source['issue'])} ${text(source['ref'])}`);
  if (issueKeys.length === 0) return 'No work item key in "issue" or "ref".';
  if (issueKeys.length > MAX_KEYS) return `More than ${MAX_KEYS} work item keys.`;

  const commit = text(source['commit']).toLowerCase();
  if (!COMMIT.test(commit)) return '"commit" has to be a commit id of 7 to 64 hexadecimal characters.';

  const details = sanitizeDetails(source);
  // A receipt is about numbers and a state. Free text from a pipeline has no place in it.
  delete details.text;
  details.commit = commit;

  const stated = text(source['kind']);
  const hasCounts = details.passed !== undefined && details.failed !== undefined;
  let kind: ReceiptKind;
  if (stated === 'test_run' || stated === 'build') kind = stated;
  else if (stated) return '"kind" has to be test_run or build.';
  else if (hasCounts) kind = 'test_run';
  else if (details.status) kind = 'build';
  else return 'Give "passed" and "failed" for a test run, or "status" for a build.';
  if (kind === 'test_run' && !hasCounts) return 'A test run needs "passed" and "failed".';
  if (kind === 'build' && !details.status) return 'A build needs "status".';

  const short = commit.slice(0, 7);
  const given = text(source['summary']).replace(/\s+/g, ' ').slice(0, 300);
  const summary =
    given.length >= 10
      ? given
      : kind === 'test_run'
        ? `Pipeline test run on commit ${short}: ${details.passed} passed, ${details.failed} failed`
        : `Pipeline build on commit ${short}: ${details.status}`;
  const url = text(source['url']).slice(0, 2000) || null;
  return { issueKeys, kind, summary, url, details: details as Receipt['details'] };
}

/** A key reads `pod_<project id>_<48 hexadecimal characters>`, so the project is known before any lookup. */
const KEY = /^pod_([A-Za-z0-9]{1,32})_([0-9a-f]{48})$/;

export function formatPipelineKey(projectId: string, secret: string): string {
  return `pod_${projectId}_${secret}`;
}

/** The project a key claims to be for, or null when the text is not a key at all. */
export function projectOfKey(key: string): string | null {
  return KEY.exec(key.trim())?.[1] ?? null;
}

/** The key out of an `Authorization: Bearer` header or an `X-Proof-Of-Done-Key` header. Header names differ in case between callers. */
export function keyFromHeaders(headers: unknown): string | null {
  if (!headers || typeof headers !== 'object') return null;
  let bearer: string | null = null;
  for (const [name, value] of Object.entries(headers as Record<string, unknown>)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (typeof first !== 'string') continue;
    const lower = name.toLowerCase();
    if (lower === 'x-proof-of-done-key') return first.trim();
    if (lower === 'authorization' && /^bearer\s+/i.test(first)) bearer = first.replace(/^bearer\s+/i, '').trim();
  }
  return bearer;
}
