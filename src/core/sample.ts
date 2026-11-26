import { Decision, EvidenceDetails, EvidenceKind, RequiredKind } from './types';

/**
 * The sample data a project admin can load with one click. Five work items of a small
 * web shop team, each left at a different point on the way to proven, so every part of
 * the app has something to show and something to do.
 */

export const SAMPLE_LABEL = 'proof-of-done-sample';
/** The coding agent the sample pretends did the work. */
export const SAMPLE_AGENT = 'claude-code';

export interface SampleEvidence {
  kind: EvidenceKind;
  summary: string;
  url?: string;
  details?: EvidenceDetails;
  /** Left out when the evidence is still waiting for a check. */
  verdict?: { decision: Decision; reason: string };
}

export interface SampleCriterion {
  text: string;
  requiredKind: RequiredKind;
  evidence: SampleEvidence[];
}

export interface SampleItem {
  /** Stable name, so loading twice does not create a second copy. */
  slug: string;
  summary: string;
  /** First paragraph of the description. */
  intro: string;
  criteria: SampleCriterion[];
  /** Where the work item is left. */
  status: 'todo' | 'in_progress' | 'done';
  /** False leaves the criteria in the description, for the reader to turn into a contract. */
  withContract: boolean;
}

export const SAMPLE_ITEMS: readonly SampleItem[] = [
  {
    slug: 'account-lockout',
    summary: 'Sample: Lock an account after five failed logins',
    intro: 'Someone is guessing passwords on the login form. Lock an account after repeated failures.',
    status: 'done',
    withContract: true,
    criteria: [
      {
        text: 'Five failed logins within one minute lock the account for 15 minutes',
        requiredKind: 'test_run',
        evidence: [
          {
            kind: 'test_run',
            summary: 'Lockout suite on the login endpoint, run on the merge commit',
            url: 'https://example.com/ci/runs/8841',
            details: { passed: 14, failed: 0, command: 'npm test -- auth/lockout', commit: '4f2c9ab' },
            verdict: { decision: 'accepted', reason: 'The run covers the fifth failure and the 15 minute window, and nothing failed.' },
          },
        ],
      },
      {
        text: 'The change is merged through a reviewed pull request',
        requiredKind: 'pull_request',
        evidence: [
          {
            kind: 'pull_request',
            summary: 'Add account lockout to the login endpoint',
            url: 'https://example.com/storefront/pull/482',
            details: { status: 'merged', commit: '4f2c9ab' },
            verdict: { decision: 'accepted', reason: 'Merged after one approving review.' },
          },
        ],
      },
      {
        text: 'The lockout message does not reveal whether the account exists',
        requiredKind: 'any',
        evidence: [
          {
            kind: 'attestation',
            summary: 'I tried a known address and an unknown one. Both get the same message.',
            verdict: { decision: 'accepted', reason: 'Attested by the security lead, who did not do the work.' },
          },
        ],
      },
    ],
  },
  {
    slug: 'reset-link',
    summary: 'Sample: Fix the broken link in the password reset email',
    intro: 'Customers report that the link in the reset email leads to a page that does not exist.',
    status: 'done',
    withContract: true,
    criteria: [
      {
        text: 'The reset link opens the reset form on the production domain',
        requiredKind: 'any',
        evidence: [
          {
            kind: 'test_run',
            summary: 'End-to-end run of the password reset flow',
            url: 'https://example.com/ci/runs/8902',
            details: { passed: 6, failed: 2, command: 'npm run e2e -- reset', commit: '9d01e77' },
          },
        ],
      },
      { text: 'The link expires after 30 minutes', requiredKind: 'any', evidence: [] },
      { text: 'Support confirms the fix with the customer who reported it', requiredKind: 'attestation', evidence: [] },
    ],
  },
  {
    slug: 'audit-export',
    summary: 'Sample: Export the audit log as CSV',
    intro: 'Compliance asks for a monthly export of the audit log.',
    status: 'in_progress',
    withContract: true,
    criteria: [
      {
        text: 'The export contains every audit event in the chosen date range',
        requiredKind: 'any',
        evidence: [
          {
            kind: 'test_run',
            summary: 'Export suite against a seeded audit log',
            url: 'https://example.com/ci/runs/8917',
            details: { passed: 9, failed: 0, command: 'npm test -- audit/export', commit: 'c31b7e0' },
          },
        ],
      },
      {
        text: 'An export of 100,000 rows finishes in under 10 seconds',
        requiredKind: 'any',
        evidence: [
          {
            kind: 'other',
            summary: 'Benchmark on staging: 100,000 rows exported in 6.2 seconds',
            url: 'https://example.com/benchmarks/audit-export',
          },
        ],
      },
      {
        text: 'The columns match the documented schema',
        requiredKind: 'document',
        evidence: [
          {
            kind: 'document',
            summary: 'Schema page updated with the export columns',
            url: 'https://example.com/docs/audit-export-schema',
            verdict: { decision: 'accepted', reason: 'The columns in a fresh export match the page.' },
          },
        ],
      },
    ],
  },
  {
    slug: 'payment-sdk',
    summary: 'Sample: Upgrade the payment SDK to version 4',
    intro: 'Version 3 of the payment SDK stops working in March.',
    status: 'in_progress',
    withContract: true,
    criteria: [
      { text: 'All checkout tests pass on SDK version 4', requiredKind: 'test_run', evidence: [] },
      { text: 'The release branch build is green', requiredKind: 'build', evidence: [] },
      { text: 'Finance signs off on the new fee calculation', requiredKind: 'attestation', evidence: [] },
    ],
  },
  {
    slug: 'idle-timeout',
    summary: 'Sample: Sign users out after 30 minutes without activity',
    intro: 'Shared computers in the warehouse stay signed in all day.',
    status: 'todo',
    withContract: false,
    criteria: [
      { text: 'A session ends after 30 minutes without a request', requiredKind: 'any', evidence: [] },
      { text: 'The user sees a notice one minute before the session ends', requiredKind: 'any', evidence: [] },
      { text: 'Unsaved form input survives the sign-in that follows', requiredKind: 'any', evidence: [] },
    ],
  },
];

/**
 * The guided run: one sample work item that a project admin walks through in a minute,
 * to see a false "done" caught. Every step runs the same services a real agent and a
 * real pipeline reach. Nothing here needs a repository, a pipeline or a coding agent.
 */

export const GUIDE_SLUG = 'guided-run';
/** The name the simulated agent gives for itself, so its evidence reads as sample data wherever it shows. */
export const GUIDE_AGENT = `${SAMPLE_AGENT} (sample)`;
/** The workflow name on every simulated pipeline result. The pages read it to label the result as sample data. */
export const GUIDE_WORKFLOW = 'proof-of-done-guided-run';

export const GUIDE_ITEM: SampleItem = {
  slug: GUIDE_SLUG,
  summary: 'Sample: Apply a discount code at checkout',
  intro: 'Customers with a discount code have nowhere to enter it. Add the field to the checkout and apply the discount to the total.',
  status: 'in_progress',
  withContract: false,
  criteria: [{ text: 'All checkout tests pass', requiredKind: 'test_run', evidence: [] }],
};

export const GUIDE_COMMITS = {
  first: 'a1f3c9e07b2d4c58916e0fa3d7b84c21e5f6a903',
  fix: 'b72d04a9c1e358f60a47d92b3ce81f05d6a7b4e2',
  next: 'c9e51b3f8a06d72e4b1c95a0e3d67f28b4c0a1d5',
} as const;

export type GuideStepId = 'start' | 'claim' | 'pipeline_fails' | 'fix_passes' | 'new_commit' | 'passes_again';

export interface GuideStep {
  id: GuideStepId;
  /** What the button says that runs this step. */
  label: string;
  /** What happened, once it ran. `{key}` is the work item. */
  done: string;
}

const short = (commit: string): string => commit.slice(0, 7);

export const GUIDE_STEPS: readonly GuideStep[] = [
  {
    id: 'start',
    label: 'Start the one-minute run',
    done: `The app made {key} with a done contract of one criterion: "${GUIDE_ITEM.criteria[0]!.text}".`,
  },
  {
    id: 'claim',
    label: 'The agent says it is done',
    done: `The coding agent reported 12 passed and 0 failed on commit ${short(GUIDE_COMMITS.first)}. That is the agent's own word.`,
  },
  {
    id: 'pipeline_fails',
    label: 'The pipeline reports the same commit',
    done: `The pipeline ran commit ${short(GUIDE_COMMITS.first)} itself: 10 passed, 2 failed. The app turned the agent's claim away.`,
  },
  {
    id: 'fix_passes',
    label: 'The agent pushes a fix',
    done: `The pipeline ran the fix, commit ${short(GUIDE_COMMITS.fix)}: 12 passed, 0 failed.`,
  },
  {
    id: 'new_commit',
    label: 'The agent pushes one more commit',
    done: `The pipeline built commit ${short(GUIDE_COMMITS.next)}. Its tests have not reported yet, so the proof is about the commit before.`,
  },
  {
    id: 'passes_again',
    label: 'The pipeline tests the new commit',
    done: `The pipeline ran commit ${short(GUIDE_COMMITS.next)}: 13 passed, 0 failed.`,
  },
];
