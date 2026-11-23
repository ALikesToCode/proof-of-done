import { describe, expect, it } from 'vitest';
import { awaitsReview, criterionProof, evidenceStanding, gateDecision, isIndependent, proofStateOf, summarize } from '../src/core/proof';
import { Criterion, Evidence, Verdict } from '../src/core/types';

let clock = 1_000;
const criterion = (id: string, active = true): Criterion => ({
  id,
  issueId: 'i1',
  position: 0,
  text: `criterion ${id}`,
  source: 'manual',
  sourceRef: null,
  requiredKind: 'any',
  active,
  createdBy: 'ann',
  createdAt: clock++,
});
const evidence = (id: string, criterionId: string, over: Partial<Evidence> = {}): Evidence => ({
  id,
  criterionId,
  issueId: 'i1',
  kind: 'other',
  summary: 'some evidence here',
  url: null,
  details: {},
  channel: 'agent',
  actorAccountId: 'ann',
  agentName: 'claude-code',
  checks: [],
  checksPassed: true,
  createdAt: clock++,
  ...over,
});
const verdict = (id: string, e: Evidence, decision: Verdict['decision'], over: Partial<Verdict> = {}): Verdict => ({
  id,
  evidenceId: e.id,
  criterionId: e.criterionId,
  issueId: 'i1',
  decision,
  reason: 'because',
  channel: 'ui',
  actorAccountId: 'bob',
  independent: true,
  createdAt: clock++,
  ...over,
});

describe('isIndependent', () => {
  it('is false when a person accepts evidence they typed in themselves', () => {
    expect(isIndependent({ channel: 'ui', actorAccountId: 'ann' }, { channel: 'ui', actorAccountId: 'ann' })).toBe(false);
  });
  it('is true when another person decides', () => {
    expect(isIndependent({ channel: 'ui', actorAccountId: 'ann' }, { channel: 'ui', actorAccountId: 'bob' })).toBe(true);
  });
  it('is true when a person reviews what their own agent submitted', () => {
    expect(isIndependent({ channel: 'agent', actorAccountId: 'ann' }, { channel: 'ui', actorAccountId: 'ann' })).toBe(true);
  });
  it('is true for the verifier agent, whoever started the chat', () => {
    expect(isIndependent({ channel: 'ui', actorAccountId: 'ann' }, { channel: 'verifier', actorAccountId: 'ann' })).toBe(true);
  });
  it('is false when the account of either side is unknown and the evidence was typed in', () => {
    expect(isIndependent({ channel: 'ui', actorAccountId: null }, { channel: 'ui', actorAccountId: 'bob' })).toBe(false);
  });
});

describe('evidenceStanding', () => {
  it('follows checks first, then the newest verdict', () => {
    const e = evidence('e1', 'c1');
    expect(evidenceStanding({ ...e, checksPassed: false }, [])).toBe('failed_checks');
    expect(evidenceStanding(e, [])).toBe('pending');
    const accepted = verdict('v1', e, 'accepted');
    expect(evidenceStanding(e, [accepted])).toBe('accepted');
    const revoked = verdict('v2', e, 'rejected');
    expect(evidenceStanding(e, [accepted, revoked])).toBe('rejected');
    expect(evidenceStanding(e, [revoked, accepted])).toBe('rejected');
  });
  it('marks an acceptance by the submitter as self-accepted', () => {
    const e = evidence('e1', 'c1');
    expect(evidenceStanding(e, [verdict('v1', e, 'accepted', { independent: false })])).toBe('self_accepted');
  });
});

describe('awaitsReview', () => {
  it('holds for evidence nobody decided on, and for a self-review where a second check is required', () => {
    expect(awaitsReview('pending', false)).toBe(true);
    expect(awaitsReview('pending', true)).toBe(true);
    expect(awaitsReview('self_accepted', true)).toBe(true);
    expect(awaitsReview('self_accepted', false)).toBe(false);
    expect(awaitsReview('accepted', true)).toBe(false);
    expect(awaitsReview('rejected', true)).toBe(false);
    expect(awaitsReview('failed_checks', true)).toBe(false);
  });
});

describe('criterionProof', () => {
  it('is unproven with no evidence and rejected when all evidence failed', () => {
    expect(criterionProof('c1', [], [], true).state).toBe('unproven');
    const failed = evidence('e1', 'c1', { checksPassed: false });
    expect(criterionProof('c1', [failed], [], true).state).toBe('rejected');
  });
  it('is submitted while evidence waits for a check', () => {
    expect(criterionProof('c1', [evidence('e1', 'c1')], [], true).state).toBe('submitted');
  });
  it('is proven by one independently accepted piece of evidence, even next to rejected ones', () => {
    const bad = evidence('e1', 'c1');
    const good = evidence('e2', 'c1');
    const verdicts = [verdict('v1', bad, 'rejected'), verdict('v2', good, 'accepted')];
    expect(criterionProof('c1', [bad, good], verdicts, true)).toEqual({ state: 'proven', selfReviewed: false, needsIndependent: false });
  });
  it('keeps a self-accepted criterion open when the project requires an independent check', () => {
    const e = evidence('e1', 'c1', { channel: 'ui' });
    const self = verdict('v1', e, 'accepted', { independent: false, actorAccountId: 'ann' });
    expect(criterionProof('c1', [e], [self], true)).toEqual({ state: 'submitted', selfReviewed: false, needsIndependent: true });
    expect(criterionProof('c1', [e], [self], false)).toEqual({ state: 'proven', selfReviewed: true, needsIndependent: false });
  });
  it('ignores evidence that belongs to other criteria', () => {
    const other = evidence('e1', 'c2');
    expect(criterionProof('c1', [other], [verdict('v1', other, 'accepted')], true).state).toBe('unproven');
  });
});

describe('summarize', () => {
  it('counts active criteria by state and names the overall state', () => {
    const c1 = criterion('c1');
    const c2 = criterion('c2');
    const c3 = criterion('c3');
    const removed = criterion('c4', false);
    const e1 = evidence('e1', 'c1');
    const e2 = evidence('e2', 'c2');
    const summary = summarize([c1, c2, c3, removed], [e1, e2], [verdict('v1', e1, 'accepted')], true);
    expect(summary).toEqual({ total: 3, proven: 1, submitted: 1, rejected: 0, unproven: 1, selfReviewed: 0, state: 'partial' });
  });
  it('is "none" without criteria, "unproven" without evidence and "proven" when everything is accepted', () => {
    expect(summarize([], [], [], true).state).toBe('none');
    const c1 = criterion('c1');
    expect(summarize([c1], [], [], true).state).toBe('unproven');
    const e1 = evidence('e1', 'c1');
    expect(summarize([c1], [e1], [verdict('v1', e1, 'accepted')], true).state).toBe('proven');
  });
});

describe('proofStateOf', () => {
  it('calls a work item partly proven only when a criterion is proven', () => {
    expect(proofStateOf(0, 0)).toBe('none');
    expect(proofStateOf(3, 0)).toBe('unproven');
    expect(proofStateOf(3, 1)).toBe('partial');
    expect(proofStateOf(3, 3)).toBe('proven');
  });
});

describe('gateDecision', () => {
  const warn = { gateMode: 'warn' as const, enforceWithoutContract: false };
  it('passes work with no contract unless the project requires one', () => {
    expect(gateDecision(null, warn).pass).toBe(true);
    expect(gateDecision(null, { ...warn, enforceWithoutContract: true }).pass).toBe(false);
  });
  it('passes proven work and blocks the rest with a count', () => {
    const c1 = criterion('c1');
    const c2 = criterion('c2');
    const e1 = evidence('e1', 'c1');
    const proven = summarize([c1], [e1], [verdict('v1', e1, 'accepted')], true);
    expect(gateDecision(proven, warn)).toEqual({ pass: true, reason: 'The one criterion is proven.' });
    const both = summarize([c1, c2], [e1, evidence('e2', 'c2')], [verdict('v1', e1, 'accepted'), verdict('v2', evidence('e2', 'c2'), 'accepted')], true);
    expect(gateDecision(both, warn)).toEqual({ pass: true, reason: 'All 2 criteria are proven.' });
    const waiting = summarize([c1, c2], [e1], [], true);
    expect(waiting.state).toBe('unproven');
    expect(gateDecision(waiting, warn)).toEqual({
      pass: false,
      reason: '2 of 2 criteria are not proven (1 with no evidence, 1 waiting for a check).',
    });
  });
  it('speaks of the one criterion when a contract has only one', () => {
    const c1 = criterion('c1');
    const e1 = evidence('e1', 'c1');
    expect(gateDecision(summarize([c1], [], [], true), warn)).toEqual({ pass: false, reason: 'The one criterion has no evidence.' });
    expect(gateDecision(summarize([c1], [e1], [], true), warn)).toEqual({
      pass: false,
      reason: 'The evidence for the one criterion waits for a check.',
    });
    expect(gateDecision(summarize([c1], [e1], [verdict('v1', e1, 'rejected')], true), warn)).toEqual({
      pass: false,
      reason: 'The evidence for the one criterion was turned away.',
    });
  });
  it('always passes when the gate is off', () => {
    expect(gateDecision(summarize([criterion('c1')], [], [], true), { gateMode: 'off', enforceWithoutContract: true }).pass).toBe(true);
  });
});
