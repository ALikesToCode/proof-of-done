import { describe, expect, it } from 'vitest';
import { extractCriteria, suggestKind } from '../src/core/extract';
import { br, doc, h, li, ol, p, tasks, ul } from './helpers/adf';

const texts = (d: ReturnType<typeof doc>) => extractCriteria(d).map((c) => c.text);

describe('extractCriteria', () => {
  it('reads the list under an "Acceptance Criteria:" paragraph, as in the seeded demo stories', () => {
    const d = doc(
      p('As a user, I want to enhance security by implementing two-factor authentication.'),
      p('Acceptance Criteria:'),
      ul(
        'Implement a secure mechanism for storing and handling authentication data.',
        'Conduct thorough security testing to identify and address any vulnerabilities.',
        'Provide clear user instructions for setting up and using two-factor authentication.',
      ),
    );
    const found = extractCriteria(d);
    expect(found.map((c) => c.text)).toEqual([
      'Implement a secure mechanism for storing and handling authentication data.',
      'Conduct thorough security testing to identify and address any vulnerabilities.',
      'Provide clear user instructions for setting up and using two-factor authentication.',
    ]);
    expect(found.map((c) => c.suggestedKind)).toEqual(['any', 'test_run', 'document']);
    expect(found[0]?.anchor).toBe('Acceptance Criteria');
  });

  it('reads a list under a heading and stops at the next heading', () => {
    const d = doc(
      h(2, 'Definition of Done'),
      ol('Unit tests pass', 'Docs updated'),
      h(2, 'Notes'),
      ul('This is not a criterion'),
    );
    expect(texts(d)).toEqual(['Unit tests pass', 'Docs updated']);
  });

  it('ignores lists that are not under a criteria label', () => {
    const d = doc(p('Key objectives include:'), ul('Allow users to rearrange widgets', 'Support themes'));
    expect(texts(d)).toEqual([]);
  });

  it('returns nothing for an empty or missing description', () => {
    expect(extractCriteria(null)).toEqual([]);
    expect(extractCriteria(doc())).toEqual([]);
  });

  it('takes a criterion written on the same line as the label', () => {
    expect(texts(doc(p('Acceptance criteria: the export finishes in under 5 seconds')))).toEqual([
      'the export finishes in under 5 seconds',
    ]);
  });

  it('reads dash bullets typed as plain lines with hard breaks', () => {
    const d = doc(p('AC:', br(), '- Login works with SSO', br(), '- Logout clears the session', br(), '2) Errors are logged'));
    expect(texts(d)).toEqual(['Login works with SSO', 'Logout clears the session', 'Errors are logged']);
  });

  it('groups a Gherkin scenario into one criterion and splits scenarios', () => {
    const d = doc(
      h(3, 'Acceptance criteria'),
      p('Given a signed-in user', br(), 'When they open the dashboard', br(), 'Then they see their widgets'),
      p('Given a signed-out user', br(), 'When they open the dashboard', br(), 'Then they are sent to login'),
    );
    expect(texts(d)).toEqual([
      'Given a signed-in user When they open the dashboard Then they see their widgets',
      'Given a signed-out user When they open the dashboard Then they are sent to login',
    ]);
  });

  it('flattens nested lists and drops a parent line that only introduces its children', () => {
    const d = doc(
      p('Acceptance Criteria'),
      ul(li(p('Passwords:'), ul('At least 12 characters', 'Checked against a breach list')), 'Session expires after 30 minutes'),
    );
    expect(texts(d)).toEqual(['At least 12 characters', 'Checked against a breach list', 'Session expires after 30 minutes']);
  });

  it('finds a label that is itself a list item, as in seeded bug reports', () => {
    const d = doc(
      ol(
        li(p('Steps to Reproduce:'), ul('Open the app', 'Tap the logistics icon')),
        li(p('Expected Result:'), ul('No skull icon appears', 'The item detail opens')),
      ),
    );
    expect(texts(d)).toEqual(['Expected: No skull icon appears', 'Expected: The item detail opens']);
  });

  it('reads task lists and strips checkbox markers', () => {
    expect(texts(doc(p('Done when'), tasks('Migration applied', 'Rollback tested')))).toEqual(['Migration applied', 'Rollback tested']);
    expect(texts(doc(p('DoD:', br(), '[ ] Changelog entry', br(), '[x] Screenshots attached')))).toEqual([
      'Changelog entry',
      'Screenshots attached',
    ]);
  });

  it('treats prose after the list as commentary, not a criterion', () => {
    const d = doc(p('Acceptance Criteria:'), ul('First item', 'Second item'), p('Talk to Priya before starting.'), ul('Not a criterion'));
    expect(texts(d)).toEqual(['First item', 'Second item']);
  });

  it('removes duplicates, very short items and caps the length', () => {
    const long = 'x'.repeat(700);
    const found = texts(doc(p('Acceptance criteria'), ul('Works on iOS', 'works on ios', 'ok', long)));
    expect(found).toHaveLength(2);
    expect(found[1]?.length).toBe(500);
  });

  it('looks inside panels and keeps reading a section across them', () => {
    const d = doc({ type: 'panel', attrs: { panelType: 'info' }, content: [p('Success criteria:'), ul('Latency under 200 ms')] });
    expect(texts(d)).toEqual(['Latency under 200 ms']);
  });

  it('does not mistake ordinary sentences for labels', () => {
    expect(texts(doc(p('Acceptance criteria are discussed in the linked page.'), ul('Nope')))).toEqual([]);
    expect(texts(doc(p('Account settings'), ul('Nope')))).toEqual([]);
  });
});

describe('suggestKind', () => {
  it.each([
    ['All unit tests pass in CI', 'test_run'],
    ['Product owner signs off on the copy', 'attestation'],
    ['Changes are code reviewed and merged', 'pull_request'],
    ['The pipeline deploys to staging', 'build'],
    ['README explains the new flag', 'document'],
    ['The button is blue', 'any'],
  ])('%s -> %s', (text, kind) => {
    expect(suggestKind(text)).toBe(kind);
  });
});
