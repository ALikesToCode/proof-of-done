import { describe, expect, it } from 'vitest';
import { CheckInput, checksPassed, runChecks, sanitizeDetails } from '../src/core/checks';

const base: CheckInput = {
  requiredKind: 'any',
  kind: 'other',
  summary: 'Screenshot of the new settings page',
  url: 'https://example.com/shot.png',
  details: {},
  channel: 'ui',
};
const failures = (input: Partial<CheckInput>) =>
  runChecks({ ...base, ...input })
    .filter((r) => !r.ok)
    .map((r) => r.id);

describe('runChecks', () => {
  it('passes plain evidence with a summary and a link', () => {
    expect(checksPassed(runChecks(base))).toBe(true);
  });

  it('rejects evidence of the wrong kind for the criterion', () => {
    expect(failures({ requiredKind: 'test_run', kind: 'document' })).toEqual(['kind.match']);
  });

  it('wants a real summary and a real link', () => {
    expect(failures({ summary: 'done' })).toEqual(['summary.present']);
    expect(failures({ url: 'javascript:alert(1)' })).toEqual(['url.valid']);
    expect(failures({ url: 'not a url' })).toEqual(['url.valid']);
  });

  it('accepts a green test run and explains a red one', () => {
    const green = { kind: 'test_run' as const, url: null, details: { passed: 42, failed: 0, exitCode: 0 } };
    expect(failures(green)).toEqual([]);
    expect(failures({ ...green, details: { passed: 40, failed: 2, exitCode: 1 } })).toEqual(['test_run.failed', 'test_run.exit']);
    const notes = runChecks({ ...base, ...green, details: { passed: 40, failed: 1 } }).filter((r) => !r.ok);
    expect(notes[0]?.note).toBe('1 test failed, so this run proves nothing yet.');
  });

  it('does not accept a test run with no counts or no passing tests', () => {
    expect(failures({ kind: 'test_run', url: null, details: {} })).toEqual(['test_run.counts']);
    expect(failures({ kind: 'test_run', url: null, details: { passed: 0, failed: 0 } })).toEqual(['test_run.passed']);
  });

  it('needs a passing build that someone can find', () => {
    expect(failures({ kind: 'build', details: { status: 'success' } })).toEqual([]);
    expect(failures({ kind: 'build', details: { status: 'failed' } })).toEqual(['build.status']);
    expect(failures({ kind: 'build', url: null, details: { status: 'passed' } })).toEqual(['build.reference']);
    expect(failures({ kind: 'build', url: null, details: { status: 'passed', commit: 'abc1234' } })).toEqual([]);
  });

  it('checks that a pull request link is one and that it was not closed unmerged', () => {
    const pr = { kind: 'pull_request' as const, url: 'https://github.com/acme/app/pull/12' };
    expect(failures({ ...pr, details: { status: 'merged' } })).toEqual([]);
    expect(failures({ ...pr, details: { status: 'open' } })).toEqual([]);
    expect(failures({ ...pr, details: { status: 'closed' } })).toEqual(['pull_request.state']);
    expect(failures({ ...pr, url: 'https://github.com/acme/app' })).toEqual(['pull_request.url']);
    // Only the path of the link counts. A query string or a fragment cannot dress a page up as a pull request.
    expect(failures({ ...pr, url: 'https://example.com/?next=/pull/1' })).toEqual(['pull_request.url']);
    expect(failures({ ...pr, url: 'https://example.com/docs#/pull/1' })).toEqual(['pull_request.url']);
    expect(failures({ ...pr, url: 'https://gitlab.com/acme/app/-/merge_requests/12?tab=files' })).toEqual([]);
    expect(failures({ ...pr, url: 'https://bitbucket.org/acme/app/pull-requests/7', details: { status: 'merged' } })).toEqual([]);
  });

  it('lets only a person attest', () => {
    const attestation = { kind: 'attestation' as const, url: null, summary: 'I reviewed the copy with legal and it is approved.' };
    expect(failures({ ...attestation, channel: 'ui' })).toEqual([]);
    expect(failures({ ...attestation, channel: 'agent' })).toEqual(['attestation.person']);
  });

  it('needs a document link, and a reference for other evidence', () => {
    expect(failures({ kind: 'document', url: null })).toEqual(['document.url']);
    expect(failures({ kind: 'other', url: null })).toEqual(['other.reference']);
    expect(failures({ kind: 'other', url: null, details: { text: 'log excerpt' } })).toEqual([]);
  });

  it('notes a reused link without failing it', () => {
    const results = runChecks({ ...base, otherUrls: [base.url as string] });
    expect(checksPassed(results)).toBe(true);
    expect(results.some((r) => r.id === 'url.reused')).toBe(true);
  });
});

describe('sanitizeDetails', () => {
  it('coerces numbers sent as strings and drops junk', () => {
    expect(sanitizeDetails({ passed: '12', failed: 0, exitCode: ' 0 ', skipped: 'many', nope: 1 })).toEqual({ passed: 12, failed: 0, exitCode: 0 });
    // A blank is no number, and a negative exit code stays, so its check still runs.
    expect(sanitizeDetails({ passed: '   ', failed: '', exitCode: -1 })).toEqual({ exitCode: -1 });
    expect(sanitizeDetails({ passed: -3, exitCode: '-9' })).toEqual({ exitCode: -9 });
  });

  it('refuses negative and fractional counts', () => {
    expect(sanitizeDetails({ passed: -1, failed: 1.5 })).toEqual({});
  });

  it('trims and limits text, lower-casing status', () => {
    const out = sanitizeDetails({ status: '  MERGED ', commit: 'a'.repeat(100), text: 't'.repeat(5000), command: '' });
    expect(out.status).toBe('merged');
    expect(out.commit).toHaveLength(64);
    expect(out.text).toHaveLength(4000);
    expect(out.command).toBeUndefined();
  });

  it('survives input that is not an object', () => {
    expect(sanitizeDetails(null)).toEqual({});
    expect(sanitizeDetails('passed=3')).toEqual({});
  });
});
