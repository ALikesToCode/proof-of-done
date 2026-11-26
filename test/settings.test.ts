import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, normalizeSettings, rulesFor } from '../src/core/settings';

describe('normalizeSettings', () => {
  it('falls back to defaults for missing or malformed input', () => {
    expect(normalizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings({ gateMode: 'explode', requireIndependent: 'yes', rules: 'none' })).toEqual(DEFAULT_SETTINGS);
  });
  it('refuses what the validator cannot check unless the project chose otherwise', () => {
    expect(normalizeSettings({}).strictGate).toBe(true);
    expect(normalizeSettings({ strictGate: 'no' }).strictGate).toBe(true);
    expect(normalizeSettings({ strictGate: false }).strictGate).toBe(false);
  });
  it('keeps valid values and cleans rules', () => {
    const settings = normalizeSettings({
      gateMode: 'bounce',
      requireIndependent: false,
      enforceWithoutContract: true,
      rules: [
        { id: 'r1', text: '  A regression   test covers the fix ', requiredKind: 'test_run', issueTypes: ['Bug', '', 7] },
        { text: 'no' },
        { text: 'Docs are updated', requiredKind: 'nonsense' },
      ],
    });
    expect(settings.gateMode).toBe('bounce');
    expect(settings.requireIndependent).toBe(false);
    expect(settings.enforceWithoutContract).toBe(true);
    expect(settings.rules).toHaveLength(2);
    expect(settings.rules[0]).toEqual({ id: 'r1', text: 'A regression test covers the fix', requiredKind: 'test_run', issueTypes: ['Bug'] });
    expect(settings.rules[1]?.requiredKind).toBe('any');
    expect(settings.rules[1]?.id).toMatch(/^[0-9A-Z]{26}$/);
  });
});

describe('rulesFor', () => {
  const settings = normalizeSettings({
    rules: [
      { id: 'a', text: 'Regression test run', requiredKind: 'test_run', issueTypes: ['Bug'] },
      { id: 'b', text: 'Merged pull request', requiredKind: 'pull_request', issueTypes: [] },
    ],
  });
  it('applies type-specific rules by name, ignoring case, and general rules to all', () => {
    expect(rulesFor(settings, 'bug').map((r) => r.id)).toEqual(['a', 'b']);
    expect(rulesFor(settings, 'Story').map((r) => r.id)).toEqual(['b']);
  });
});
