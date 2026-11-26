import { describe, expect, it } from 'vitest';
import { readMeter } from '../src/core/meter';
import { activityLine, attentionNote, contractsLine, meterFigures } from '../src/frontend/project-text';
import {
  actorLabel,
  channelLine,
  criterionBadge,
  describeEvent,
  passLine,
  uncheckedLine,
  detailLines,
  excerptHead,
  proofLine,
  sourceLine,
  timeAgo,
  verifierPrompt,
  waitingForReview,
  waitingLine,
} from '../src/frontend/text';
import type { CriterionView, EvidenceView } from '../src/services/view';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe('timeAgo', () => {
  const now = Date.UTC(2026, 10, 23, 12, 0, 0);
  it.each([
    [10_000, 'just now'],
    [70_000, 'a minute ago'],
    [12 * MINUTE, '12 minutes ago'],
    [70 * MINUTE, 'an hour ago'],
    [5 * HOUR, '5 hours ago'],
    [30 * HOUR, 'yesterday'],
    [6 * DAY, '6 days ago'],
    [60 * DAY, '24 Sep 2026'],
  ])('%d ms ago reads "%s"', (elapsed, expected) => {
    expect(timeAgo(now - elapsed, now)).toBe(expected);
  });

  it('does not go negative when clocks disagree', () => {
    expect(timeAgo(now + 5_000, now)).toBe('just now');
  });
});

describe('badges and lines', () => {
  it('names each criterion state', () => {
    expect(criterionBadge({ state: 'unproven', selfReviewed: false, needsIndependent: false }).label).toBe('No evidence');
    expect(criterionBadge({ state: 'submitted', selfReviewed: false, needsIndependent: false }).label).toBe('Waiting for a check');
    expect(criterionBadge({ state: 'submitted', selfReviewed: false, needsIndependent: true }).label).toBe('Needs a second person');
    expect(criterionBadge({ state: 'rejected', selfReviewed: false, needsIndependent: false }).tone).toBe('removed');
    expect(criterionBadge({ state: 'proven', selfReviewed: false, needsIndependent: false })).toEqual({ label: 'Proven', tone: 'success' });
    expect(criterionBadge({ state: 'proven', selfReviewed: true, needsIndependent: false }).label).toBe('Proven, self-reviewed');
  });

  it('says where a criterion came from', () => {
    expect(sourceLine('description', 'Acceptance Criteria')).toBe('From the description, under "Acceptance Criteria"');
    expect(sourceLine('description', null)).toBe('From the description');
    expect(sourceLine('manual', null)).toBe('Added by hand');
    expect(sourceLine('project_rule', 'r1')).toBe('Project rule');
  });

  it('lists the structured fields of evidence', () => {
    expect(detailLines({ passed: 120, failed: 0, skipped: 3, exitCode: 0, command: 'npm test' })).toEqual([
      '120 passed, 0 failed, 3 skipped',
      'Exit code 0',
      'Command: npm test',
    ]);
    expect(detailLines({ status: 'passed', commit: 'abc123' })).toEqual(['Result: passed', 'Commit abc123']);
    expect(detailLines({ status: 'passed' }, 'build')).toEqual(['Result: passed']);
    // A pull request has a state. "Result: merged" reads as if merging were a test.
    expect(detailLines({ status: 'merged' }, 'pull_request')).toEqual(['State: merged']);
    expect(detailLines({ status: 'closed' }, 'pull_request')).toEqual(['State: closed without merging']);
    expect(detailLines({ status: 'declined' }, 'pull_request')).toEqual(['State: declined']);
    expect(detailLines({})).toEqual([]);
  });

  it('counts criteria in plain words', () => {
    expect(proofLine(0, 0)).toBe('No criteria yet');
    expect(proofLine(1, 1)).toBe('1 of 1 criterion proven');
    expect(proofLine(2, 5)).toBe('2 of 5 criteria proven');
  });
});

describe('asking the Proof Verifier', () => {
  const evidence = (standing: EvidenceView['standing']) => ({ standing }) as EvidenceView;
  const view = (requireIndependent: boolean) => ({
    policy: { requireIndependent, gateMode: 'warn' as const, pipelineOnly: false, strictGate: true },
    criteria: [
      { evidence: [evidence('pending'), evidence('rejected')] },
      { evidence: [evidence('self_accepted'), evidence('accepted'), evidence('failed_checks')] },
      { evidence: [] },
    ] as unknown as CriterionView[],
  });

  it('counts the evidence a reviewer can still decide on', () => {
    expect(waitingForReview(view(false))).toBe(1);
    expect(waitingForReview(view(true))).toBe(2);
    expect(waitingForReview({ ...view(true), criteria: [] })).toBe(0);
  });

  it('words the count and the request', () => {
    expect(waitingLine(1)).toBe('1 piece of evidence waits for a check.');
    expect(waitingLine(3)).toBe('3 pieces of evidence wait for a check.');
    expect(verifierPrompt('POD-7')).toBe('Review the evidence that waits for a verdict on POD-7.');
  });
});

describe('describeEvent', () => {
  it('reads as a phrase after a name', () => {
    expect(describeEvent({ type: 'contract.created', data: { criteria: 3 } })).toBe('created the contract with 3 criteria');
    expect(describeEvent({ type: 'contract.created', data: { criteria: 1 } })).toBe('created the contract with 1 criterion');
    expect(describeEvent({ type: 'contract.created', data: { criteria: 0 } })).toBe('created an empty contract');
    expect(describeEvent({ type: 'criterion.added', data: { text: 'Login works' } })).toBe('added the criterion "Login works"');
    expect(describeEvent({ type: 'criterion.replaced', data: { text: 'B', previousText: 'A' } })).toBe('changed "A" to "B"');
    expect(describeEvent({ type: 'criterion.replaced', data: { text: 'A', previousText: 'A' } })).toBe('changed what "A" needs');
  });

  it('describes evidence and verdicts', () => {
    expect(describeEvent({ type: 'evidence.submitted', data: { kind: 'test_run', text: 'Tests pass', checksPassed: false } })).toBe(
      'submitted test run evidence for "Tests pass". It failed its checks.',
    );
    expect(describeEvent({ type: 'verdict.recorded', data: { decision: 'rejected', by: 'ui', text: 'Tests pass', reason: 'Wrong branch' } })).toBe(
      'rejected evidence for "Tests pass". Reason: Wrong branch',
    );
    expect(describeEvent({ type: 'verdict.recorded', data: { decision: 'accepted', by: 'ui', independent: false, text: 'Tests pass', reason: 'Accepted.' } })).toBe(
      'accepted evidence for "Tests pass" as a self-review.',
    );
    expect(describeEvent({ type: 'verdict.recorded', data: { decision: 'accepted', by: 'verifier', independent: true, text: 'Tests pass', reason: 'Run is green' } })).toBe(
      'asked the Proof Verifier, which accepted evidence for "Tests pass". Reason: Run is green',
    );
    expect(describeEvent({ type: 'verdict.recorded', data: { decision: 'accepted', by: 'attestation', text: 'Copy approved' } })).toBe('attested "Copy approved"');
  });

  it('shortens long text and survives unknown events', () => {
    const long = 'x'.repeat(200);
    expect(describeEvent({ type: 'criterion.removed', data: { text: long } }).length).toBeLessThan(130);
    expect(describeEvent({ type: 'something.new', data: {} })).toBe('something.new');
  });
});

describe('a check that could not be made, and a pass', () => {
  const REASON = "The app's storage did not answer, so it could not check MOBL-1.";

  it('says in the history what the validator did', () => {
    expect(describeEvent({ type: 'gate.blocked', data: { reason: REASON, unchecked: true } })).toBe(
      `tried to move the work item on, and the workflow validator refused because it could not check. ${REASON}`,
    );
    expect(describeEvent({ type: 'gate.unchecked', data: { reason: REASON } })).toBe(
      `moved the work item on while the workflow validator could not check it. The project lets that through. ${REASON}`,
    );
    expect(describeEvent({ type: 'gate.pass_granted', data: { reason: 'Hotfix for the outage.' } })).toBe(
      'let the work item through the done gate for 30 minutes, without proof. Reason: Hotfix for the outage.',
    );
    expect(describeEvent({ type: 'gate.let_through', data: { instead: 'The one criterion has no evidence.' } })).toBe(
      'moved the work item on with that pass. Without it the validator would have refused. The one criterion has no evidence.',
    );
    expect(describeEvent({ type: 'issue.done', data: { status: 'Done', proven: false, contract: true, letThrough: true } })).toBe(
      'moved the work item to Done without proof, let through by someone who administers the project',
    );
  });

  it('says in the panel how long a pass still holds', () => {
    const pass = { until: 30 * 60_000, reason: 'Hotfix for the outage.' };
    expect(passLine(pass, 0)).toBe(
      'Someone who administers the project let this work item through for 30 more minutes. Reason: Hotfix for the outage. It is still not proven.',
    );
    expect(passLine(pass, 29 * 60_000 + 20_000)).toContain('for one more minute.');
  });

  it('says in the panel what happened and what to do', () => {
    const at = 1_700_000_000_000;
    expect(uncheckedLine({ at, reason: REASON, refused: true }, at + 5 * 60_000, false)).toBe(
      `5 minutes ago: ${REASON} This project refuses a transition the app cannot check. Try the transition again. If it lasts, someone who administers the project can let this work item through here.`,
    );
    expect(uncheckedLine({ at, reason: REASON, refused: true }, at, true)).toContain('Just now:');
    expect(uncheckedLine({ at, reason: REASON, refused: true }, at, true)).toContain('you can let this work item through below.');
    expect(uncheckedLine({ at, reason: REASON, refused: false }, at, true)).toBe(
      `Just now: ${REASON} This project lets such a transition through, so check the proof below.`,
    );
  });
});

describe('gate events and sample entries', () => {
  it('describes what the done gate saw', () => {
    expect(describeEvent({ type: 'issue.done', data: { status: 'Done', proven: true, contract: true } })).toBe(
      'moved the work item to Done with every criterion proven',
    );
    expect(describeEvent({ type: 'issue.done', data: { status: 'Done', proven: false, contract: true } })).toBe(
      'moved the work item to Done without proof',
    );
    expect(describeEvent({ type: 'issue.done', data: { status: 'Closed', proven: false, contract: false } })).toBe(
      'moved the work item to Closed before it had a contract',
    );
    expect(describeEvent({ type: 'issue.reopened', data: { fromStatus: 'Done', status: 'In Progress' } })).toBe(
      'moved the work item from Done back to In Progress',
    );
  });

  it('describes what the done gate did', () => {
    const reason = '2 of 3 criteria are not proven (2 with no evidence).';
    expect(describeEvent({ type: 'gate.warned', data: { reason } })).toBe(`got a warning from the done gate. ${reason}`);
    expect(describeEvent({ type: 'gate.bounced', data: { reason, backTo: 'In Progress' } })).toBe(
      `closed the work item without proof, and the done gate moved it back to In Progress. ${reason}`,
    );
    expect(describeEvent({ type: 'gate.blocked', data: { reason } })).toBe(
      `tried to move the work item on, and the workflow validator refused. ${reason}`,
    );
    expect(describeEvent({ type: 'gate.warned', data: {} })).toBe('got a warning from the done gate.');
  });

  it('labels sample data as sample data', () => {
    expect(actorLabel({ channel: 'sample' })).toBe('Sample data');
    expect(actorLabel({ channel: 'jira' })).toBe('The app');
    expect(channelLine({ channel: 'sample', agentName: 'claude-code' })).toBe('Sample data, as if submitted by the agent claude-code');
    expect(channelLine({ channel: 'sample', agentName: null })).toBe('Sample data, as if added by a person');
    expect(channelLine({ channel: 'ci', agentName: null, details: { workflow: 'proof-of-done-guided-run' } })).toBe(
      "Sample data, as if reported by the project's pipeline",
    );
    expect(channelLine({ channel: 'ci', agentName: null, details: { workflow: 'ci.yml' } })).toBe("Reported by the project's pipeline");
    expect(describeEvent({ type: 'sample.step', data: { step: 'pipeline_fails', pass: false, reason: 'The evidence for the one criterion was turned away.' } })).toBe(
      'ran a step of the guided sample: the pipeline reports the same commit. After it the work item could not close. The evidence for the one criterion was turned away.',
    );
    expect(describeEvent({ type: 'verdict.recorded', data: { by: 'check', decision: 'rejected', text: 'Tests pass', reason: 'The pipeline says no.' } })).toBe(
      'reported a result that contradicts evidence for "Tests pass", so the app turned that evidence away. The pipeline says no.',
    );
  });
});

describe('project page wording', () => {
  const meter = readMeter({ windowDays: 7, opened: 5, reopened: 1, closed: 4, closedProven: 1, closedUnproven: 1, evidence: 1, verdicts: 3 });

  it('lists the figures behind the meter', () => {
    expect(meterFigures(meter).map((f) => [f.label, f.value])).toEqual([
      ['Opened', 5],
      ['Reopened', 1],
      ['Closed with proof', 1],
      ['Closed without proof', 1],
      ['Closed, no contract', 2],
    ]);
    expect(meterFigures(readMeter({ ...meter, closed: 2 }))).toHaveLength(4);
    expect(activityLine(meter)).toBe('1 piece of evidence and 3 verdicts in the last 7 days.');
  });

  it('says what a work item needs next', () => {
    const row = { proven: 1, total: 3, waiting: 2, rejected: 1, proofState: 'partial' as const };
    expect(attentionNote({ ...row, attention: 'closed_unproven' })).toBe('Closed without proof. 2 of 3 not proven.');
    expect(attentionNote({ ...row, attention: 'rejected' })).toBe('Evidence turned away on 1 criterion.');
    expect(attentionNote({ ...row, attention: 'waiting' })).toBe('2 waiting for a check.');
    expect(attentionNote({ ...row, attention: 'open' })).toBe('2 of 3 still to prove.');
    expect(attentionNote({ ...row, attention: 'none', proofState: 'proven' })).toBe('Nothing. Every criterion is proven.');
    expect(attentionNote({ ...row, attention: 'none', proofState: 'none' })).toBe('No criteria yet.');
  });

  it('counts the contracts and admits what it leaves out', () => {
    expect(contractsLine({ total: 0, listed: 0 })).toBe('No work item in this project has a done contract yet.');
    expect(contractsLine({ total: 1, listed: 1 })).toBe('1 work item has a done contract.');
    expect(contractsLine({ total: 4, listed: 3 })).toBe(
      '4 work items have a done contract. 1 is not listed, because you cannot see it or it was deleted.',
    );
    expect(contractsLine({ total: 9, listed: 6 })).toBe(
      '9 work items have a done contract. 3 are not listed, because you cannot see them or they were deleted.',
    );
  });
});

describe('excerptHead', () => {
  const lines = (count: number) => Array.from({ length: count }, (_, index) => `line ${index + 1}`).join('\n');

  it('keeps a short excerpt whole', () => {
    expect(excerptHead('Tests: 120 passed\nTime: 4.2 s')).toEqual({ head: 'Tests: 120 passed\nTime: 4.2 s', cut: false });
    expect(excerptHead(lines(6))).toEqual({ head: lines(6), cut: false });
  });

  it('shows the first six lines of a longer one', () => {
    expect(excerptHead(lines(9))).toEqual({ head: lines(6), cut: true });
  });

  it('cuts one very long line', () => {
    const { head, cut } = excerptHead('x'.repeat(2_000));
    expect(head).toHaveLength(480);
    expect(cut).toBe(true);
  });

  it('reads Windows line ends as line breaks', () => {
    expect(excerptHead('one\r\ntwo\r\n')).toEqual({ head: 'one\ntwo', cut: false });
  });
});
