import { newId } from './ids';
import { GateMode, ProjectRule, ProjectSettings, REQUIRED_KINDS, RequiredKind } from './types';

export const DEFAULT_SETTINGS: ProjectSettings = {
  requireIndependent: true,
  gateMode: 'warn',
  enforceWithoutContract: false,
  strictGate: true,
  pipelineProves: true,
  pipelineOnly: false,
  rules: [],
};

const GATE_MODES: readonly GateMode[] = ['off', 'warn', 'bounce'];
const MAX_RULES = 20;

/** Accepts stored or submitted settings of any shape and returns a valid object. */
export function normalizeSettings(raw: unknown): ProjectSettings {
  const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const gateMode = GATE_MODES.includes(source['gateMode'] as GateMode) ? (source['gateMode'] as GateMode) : DEFAULT_SETTINGS.gateMode;
  const rules: ProjectRule[] = [];
  if (Array.isArray(source['rules'])) {
    for (const item of source['rules']) {
      if (rules.length >= MAX_RULES) break;
      const rule = normalizeRule(item);
      if (rule) rules.push(rule);
    }
  }
  return {
    requireIndependent: typeof source['requireIndependent'] === 'boolean' ? source['requireIndependent'] : DEFAULT_SETTINGS.requireIndependent,
    gateMode,
    enforceWithoutContract:
      typeof source['enforceWithoutContract'] === 'boolean' ? source['enforceWithoutContract'] : DEFAULT_SETTINGS.enforceWithoutContract,
    strictGate: typeof source['strictGate'] === 'boolean' ? source['strictGate'] : DEFAULT_SETTINGS.strictGate,
    pipelineProves: typeof source['pipelineProves'] === 'boolean' ? source['pipelineProves'] : DEFAULT_SETTINGS.pipelineProves,
    pipelineOnly: typeof source['pipelineOnly'] === 'boolean' ? source['pipelineOnly'] : DEFAULT_SETTINGS.pipelineOnly,
    rules,
  };
}

function normalizeRule(raw: unknown): ProjectRule | null {
  if (!raw || typeof raw !== 'object') return null;
  const source = raw as Record<string, unknown>;
  const text = typeof source['text'] === 'string' ? source['text'].replace(/\s+/g, ' ').trim().slice(0, 500) : '';
  if (text.length < 3) return null;
  const requiredKind = REQUIRED_KINDS.includes(source['requiredKind'] as RequiredKind) ? (source['requiredKind'] as RequiredKind) : 'any';
  const issueTypes = Array.isArray(source['issueTypes'])
    ? source['issueTypes'].filter((t): t is string => typeof t === 'string' && t.trim().length > 0).map((t) => t.trim()).slice(0, 20)
    : [];
  const id = typeof source['id'] === 'string' && source['id'] ? source['id'] : newId();
  return { id, text, requiredKind, issueTypes };
}

/** The project rules that apply to a work item of the given type. */
export function rulesFor(settings: ProjectSettings, issueType: string): ProjectRule[] {
  const wanted = issueType.toLowerCase();
  return settings.rules.filter((rule) => rule.issueTypes.length === 0 || rule.issueTypes.some((t) => t.toLowerCase() === wanted));
}
