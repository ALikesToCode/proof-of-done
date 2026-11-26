import { CheckResult, EvidenceChannel, EvidenceDetails, EvidenceKind, RequiredKind } from './types';

/**
 * Mechanical checks on a piece of evidence. They answer "could this even be proof?",
 * never "is it proof?". Passing them only earns the evidence a place in the review
 * queue. Failing them rejects it on the spot, with the reason spelled out, so an agent
 * gets an answer it can act on in the same call.
 */

export interface CheckInput {
  requiredKind: RequiredKind;
  kind: EvidenceKind;
  summary: string;
  url: string | null;
  details: EvidenceDetails;
  channel: EvidenceChannel;
  /** URLs already submitted against other criteria of the same work item. */
  otherUrls?: string[];
  /** The project counts a test run or a build only when its pipeline reports it. */
  pipelineOnly?: boolean;
}

export const KIND_LABEL: Record<RequiredKind, string> = {
  any: 'any evidence',
  test_run: 'a test run',
  build: 'a build',
  pull_request: 'a pull request',
  document: 'a document',
  attestation: "a person's attestation",
  other: 'other evidence',
};

const PASSING_BUILD = new Set(['passed', 'pass', 'success', 'successful', 'succeeded', 'green', 'ok']);
const PULL_REQUEST_URL = /\/(pull|pulls|pull-requests|merge_requests)\/\d+/i;

export function runChecks(input: CheckInput): CheckResult[] {
  const results: CheckResult[] = [];
  const pass = (id: string, note: string) => results.push({ id, ok: true, note });
  const fail = (id: string, note: string) => results.push({ id, ok: false, note });
  const { kind, details, url } = input;

  if (input.requiredKind !== 'any' && input.requiredKind !== kind) {
    fail('kind.match', `This criterion needs ${KIND_LABEL[input.requiredKind]}, but this is ${KIND_LABEL[kind]}.`);
  } else {
    pass('kind.match', `Evidence kind fits the criterion (${KIND_LABEL[kind]}).`);
  }

  if (input.pipelineOnly && (kind === 'test_run' || kind === 'build') && input.channel !== 'ci' && input.channel !== 'sample') {
    fail(
      'source.pipeline',
      `This project counts ${KIND_LABEL[kind]} only when its pipeline reports it. The pipeline reports with the project's key, and a person or an agent cannot.`,
    );
  }

  if (input.summary.trim().length < 10) {
    fail('summary.present', 'Say in a sentence what this evidence shows (at least 10 characters).');
  } else {
    pass('summary.present', 'Summary given.');
  }

  if (url !== null) {
    if (isHttpUrl(url)) pass('url.valid', 'Link is a valid web address.');
    else fail('url.valid', 'The link must be an http or https address.');
  }

  switch (kind) {
    case 'test_run': {
      const { passed, failed, exitCode } = details;
      if (passed === undefined || failed === undefined) {
        fail('test_run.counts', 'A test run needs the number of passed and failed tests.');
        break;
      }
      if (failed > 0) fail('test_run.failed', `${failed} test${failed === 1 ? '' : 's'} failed, so this run proves nothing yet.`);
      else pass('test_run.failed', 'No failed tests.');
      if (passed < 1) fail('test_run.passed', 'No tests passed. A run with zero tests is not proof.');
      else pass('test_run.passed', `${passed} test${passed === 1 ? '' : 's'} passed.`);
      if (exitCode !== undefined) {
        if (exitCode === 0) pass('test_run.exit', 'Exit code 0.');
        else fail('test_run.exit', `The run exited with code ${exitCode}.`);
      }
      break;
    }
    case 'build': {
      const status = (details.status ?? '').toLowerCase();
      if (!status) fail('build.status', 'A build needs its result (passed or failed).');
      else if (PASSING_BUILD.has(status)) pass('build.status', `Build result: ${status}.`);
      else fail('build.status', `Build result is "${status}", not passed.`);
      if (!url && !details.commit) fail('build.reference', 'A build needs a link or a commit so someone can find it.');
      else pass('build.reference', 'Build can be located.');
      break;
    }
    case 'pull_request': {
      if (!url) {
        fail('pull_request.url', 'A pull request needs its link.');
      } else if (!isPullRequestUrl(url)) {
        fail('pull_request.url', 'The link does not look like a pull request.');
      } else {
        pass('pull_request.url', 'Link points at a pull request.');
      }
      const state = (details.status ?? '').toLowerCase();
      if (state === 'closed' || state === 'declined') {
        fail('pull_request.state', 'The pull request was closed without merging.');
      } else if (state === 'merged') {
        pass('pull_request.state', 'Pull request is merged.');
      } else {
        // Not a failure: a criterion such as "code reviewed" can be met before merge.
        pass('pull_request.state', `Pull request is ${state || 'in an unstated state'}, not merged. The reviewer should weigh that.`);
      }
      break;
    }
    case 'document': {
      if (!url) fail('document.url', 'A document needs its link.');
      else pass('document.url', 'Document link given.');
      break;
    }
    case 'attestation': {
      if (input.channel !== 'ui') {
        fail('attestation.person', 'Only a person can attest. An agent has to submit another kind of evidence.');
      } else {
        pass('attestation.person', 'Attested by a person.');
      }
      break;
    }
    case 'other': {
      if (!url && !(details.text ?? '').trim()) {
        fail('other.reference', 'Give a link or paste the relevant excerpt.');
      } else {
        pass('other.reference', 'Reference given.');
      }
      break;
    }
  }

  if (url && input.otherUrls?.includes(url)) {
    // Worth a reviewer's attention, but one pull request can honestly cover several criteria.
    pass('url.reused', 'The same link is already used for another criterion of this work item.');
  }

  return results;
}

export function checksPassed(results: CheckResult[]): boolean {
  return results.every((r) => r.ok);
}

/** Whether the path of the link names a pull request. A query string or a fragment that looks like one does not count. */
export function isPullRequestUrl(value: string): boolean {
  try {
    return PULL_REQUEST_URL.test(new URL(value).pathname);
  } catch {
    return false;
  }
}

export function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

const INT_FIELDS = ['passed', 'failed', 'skipped', 'exitCode'] as const;
const TEXT_LIMITS: Record<'command' | 'commit' | 'branch' | 'repository' | 'workflow' | 'run' | 'status' | 'text', number> = {
  command: 300,
  commit: 64,
  branch: 200,
  repository: 200,
  workflow: 200,
  run: 64,
  status: 32,
  text: 4000,
};

/**
 * Turns whatever a form or a tool call sent into a clean EvidenceDetails. Tool inputs
 * come from a language model, so numbers may arrive as strings and unknown keys are dropped.
 */
export function sanitizeDetails(raw: unknown): EvidenceDetails {
  const out: EvidenceDetails = {};
  if (!raw || typeof raw !== 'object') return out;
  const source = raw as Record<string, unknown>;
  for (const field of INT_FIELDS) {
    const value = source[field];
    if (value === undefined || value === null) continue;
    const text = typeof value === 'number' ? '' : String(value).trim();
    if (typeof value !== 'number' && text === '') continue;
    const number = typeof value === 'number' ? value : Number(text);
    // An exit code can be negative, for a process that a signal ended. Dropping it would skip its check.
    const lowest = field === 'exitCode' ? -10_000_000 : 0;
    if (Number.isInteger(number) && number >= lowest && number <= 10_000_000) out[field] = number;
  }
  for (const field of Object.keys(TEXT_LIMITS) as Array<keyof typeof TEXT_LIMITS>) {
    const value = source[field];
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    const limited = trimmed.slice(0, TEXT_LIMITS[field]);
    out[field] = field === 'status' ? limited.toLowerCase() : limited;
  }
  return out;
}
