import type { ReactElement } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { SAMPLE_ITEMS } from '../src/core/sample';
import { DEFAULT_SETTINGS } from '../src/core/settings';
import type { IssueInfo } from '../src/jira/gateway';
import { Caller, ContractService } from '../src/services/contracts';
import { doc, h, p, ul } from './helpers/adf';
import { issueInfo } from './helpers/fakes';
import { Page, mount } from './helpers/page';
import { World, resetWorld, world } from './helpers/world';

/**
 * Mounts the three pages on stand-ins for Forge and uses them as a person would. The
 * resolvers, the services and the checks underneath are the real ones. This covers
 * what the pages say and do. How Jira draws them needs a browser.
 */

vi.mock('@forge/react', () => import('./helpers/forge-react'));
vi.mock('@forge/bridge', () => import('./helpers/forge-bridge'));
vi.mock('@forge/api', () => ({ default: {}, route: () => '', isForgePlatformError: () => false }));
vi.mock('../src/store/sql-store', async () => {
  const helpers = await import('./helpers/world');
  return {
    SqlContractStore: class {
      constructor() {
        return helpers.forward(() => helpers.world().store);
      }
    },
  };
});
vi.mock('../src/jira/forge-gateway', async () => {
  const helpers = await import('./helpers/world');
  return {
    ForgeJiraGateway: class {
      constructor() {
        return helpers.forward(() => helpers.world().jira);
      }
    },
  };
});

const DESCRIPTION = doc(
  p('As a user I want to log in.'),
  h(2, 'Acceptance criteria'),
  ul('Login works with email and password', 'All unit tests pass', 'Release notes are updated'),
);

const ALICE: Caller = { accountId: 'alice', via: 'ui' };
const BOB: Caller = { accountId: 'bob', via: 'ui' };
const AGENT: Caller = { accountId: 'alice', via: 'agent', agentName: 'claude-code' };
const VERIFIER: Caller = { accountId: 'alice', via: 'verifier' };

const TEST_RUN = { kind: 'test_run', summary: 'Full unit suite on the login branch', url: 'https://ci.example.com/runs/42', details: { passed: 120, failed: 0 } };
const FAILED_RUN = { kind: 'test_run', summary: 'Unit suite after the login change', details: { passed: 118, failed: 2 } };

let pages: Record<'panel' | 'project' | 'settings', ReactElement>;
const mounted: Page[] = [];

beforeAll(async () => {
  // Each page module hands its root to ForgeReconciler when it loads.
  const { rendered } = await import('./helpers/forge-react');
  const root = async (load: () => Promise<unknown>): Promise<ReactElement> => {
    await load();
    return rendered.at(-1)!;
  };
  pages = {
    panel: await root(() => import('../src/frontend/issue-panel')),
    project: await root(() => import('../src/frontend/project-page')),
    settings: await root(() => import('../src/frontend/project-settings')),
  };
});

afterEach(() => {
  for (const page of mounted.splice(0)) page.unmount();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

async function show(page: ReactElement): Promise<Page> {
  const shown = await mount(page);
  mounted.push(shown);
  return shown;
}

/** A fresh world with MOBL-1 in it, for the issue panel of that work item. */
function onWorkItem(overrides: Partial<IssueInfo> = {}): World {
  const fresh = resetWorld();
  const issue = fresh.jira.add(issueInfo({ description: DESCRIPTION, ...overrides }));
  fresh.extension = { issue: { id: issue.id, key: issue.key }, project: { id: issue.projectId, key: issue.projectKey } };
  return fresh;
}

/** A fresh world for a page of the project Mobile Dev. */
function onProject(): World {
  const fresh = resetWorld();
  fresh.extension = { project: { id: '10000', key: 'MOBL' } };
  return fresh;
}

/** The service behind the resolvers, for what happens away from the page. */
const elsewhere = (): ContractService => new ContractService(world().store, world().jira);

/** A contract on MOBL-1 with the three criteria of the description. */
const contract = () => elsewhere().createContract('MOBL-1', ALICE, { withSuggestions: true });

/** A contract whose first criterion has a passing test run from Alice's coding agent. Returns the id of that evidence. */
async function contractWithAgentEvidence(): Promise<string> {
  const created = await contract();
  const view = await elsewhere().submitEvidence('MOBL-1', AGENT, { criterionId: created.criteria[0]!.id, ...TEST_RUN });
  return view.criteria[0]!.evidence[0]!.id;
}

const count = (items: string[], wanted: string): number => items.filter((item) => item === wanted).length;

describe('the issue panel', () => {
  it('offers the criteria it found and starts the contract with them', async () => {
    onWorkItem();
    const page = await show(pages.panel);
    expect(page.text()).toContain('A done contract lists what has to be true before MOBL-1 can close');
    expect(page.text()).toContain('3 criteria were found for this work item:');
    expect(page.text()).toContain('From the description, under "Acceptance criteria"');
    expect(page.buttons()).toEqual(['Create contract with these 3 criteria', 'Start empty']);

    await page.press('Create contract with these 3 criteria');
    expect(page.text()).toContain('0 of 3 criteria proven');
    expect(page.text()).toContain('Not ready to close. 3 of 3 criteria are not proven (3 with no evidence).');
    expect(page.labels('Lozenge')).toEqual(['Not proven', 'No evidence', 'No evidence', 'No evidence']);
    expect(world().calls).toEqual(['getContract', 'createContract']);
  });

  it('starts an empty contract and offers the criteria it leaves out', async () => {
    onWorkItem();
    const page = await show(pages.panel);
    await page.press('Start empty');
    expect(page.labels('Lozenge')).toEqual(['No criteria']);
    expect(page.text()).toContain('This contract has no criteria yet. Add the first one below.');
    expect(page.text()).toContain('3 criteria for this work item are not in the contract, for example "Login works with email and password"');

    await page.press('Add them');
    expect(page.text()).toContain('0 of 3 criteria proven');
    expect(page.buttons()).not.toContain('Add them');
  });

  it('takes a typed criterion where the description has none', async () => {
    onWorkItem({ description: null });
    const page = await show(pages.panel);
    expect(page.text()).toContain('No acceptance criteria were found in the description.');
    await page.press('Add');
    expect(page.text()).toContain('Write the criterion first (at least 3 characters).');

    await page.type('criterion', 'Login works with a passkey');
    await page.pick('criterion-kind', 'test_run');
    await page.press('Add');
    expect(page.text()).toContain('0 of 1 criterion proven');
    expect(page.text()).toContain('Not ready to close. The one criterion has no evidence.');
    expect(page.labels('Lozenge')).toEqual(['Not proven', 'No evidence', 'Needs a test run']);
    expect(page.text()).toContain('Added by hand');

    await page.type('criterion', 'login works with a passkey');
    await page.press('Add');
    expect(page.text()).toContain('"login works with a passkey" is already in the contract.');
  });

  it('shows what an agent submitted and what the checks turned away', async () => {
    onWorkItem();
    const created = await contract();
    await elsewhere().submitEvidence('MOBL-1', AGENT, { criterionId: created.criteria[0]!.id, ...TEST_RUN });
    await elsewhere().submitEvidence('MOBL-1', AGENT, { criterionId: created.criteria[1]!.id, ...FAILED_RUN });
    const page = await show(pages.panel);
    expect(page.labels('Lozenge')).toEqual(['Not proven', 'Waiting for a check', 'Waiting for a check', 'Evidence rejected', 'Failed checks', 'No evidence']);
    expect(page.text()).toContain('Submitted by the agent claude-code, just now');
    expect(page.text()).toContain('120 passed, 0 failed');
    expect(page.text()).toContain('2 tests failed, so this run proves nothing yet.');
    expect(page.all('Link').map((link) => link.props['href'])).toEqual(['https://ci.example.com/runs/42']);
    // Evidence that failed its checks is not up for review.
    expect(count(page.buttons(), 'Review')).toBe(1);
    expect(page.text()).toContain('1 piece of evidence waits for a check.');
  });

  it('hands the waiting evidence to the Proof Verifier and picks up its verdict', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    onWorkItem();
    const evidenceId = await contractWithAgentEvidence();
    const page = await show(pages.panel);

    await page.press('Ask Proof Verifier');
    expect(world().rovoOpened).toEqual([
      { type: 'forge', agentKey: 'proof-verifier', agentName: 'Proof Verifier', prompt: 'Review the evidence that waits for a verdict on MOBL-1.' },
    ]);
    expect(page.text()).toContain('The Proof Verifier has the evidence in Rovo chat. Its verdicts show up here.');

    await elsewhere().recordVerdict('MOBL-1', VERIFIER, { evidenceId, decision: 'accepted', reason: 'The run covers the login path and nothing failed.' });
    expect(page.text()).not.toContain('Accepted by the Proof Verifier');

    await page.run(() => vi.advanceTimersByTime(8_000));
    expect(page.text()).toContain('Accepted by the Proof Verifier, asked by');
    expect(page.text()).toContain('just now. The run covers the login path and nothing failed.');
    expect(page.text()).toContain('1 of 3 criteria proven');
    // Nothing waits any more, so the panel stops asking and stops looking.
    expect(page.buttons()).not.toContain('Ask Proof Verifier');
    const calls = world().calls.length;
    await page.run(() => vi.advanceTimersByTime(60_000));
    expect(world().calls).toHaveLength(calls);
  });

  it('stops looking for verdicts after five minutes', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
    onWorkItem();
    await contractWithAgentEvidence();
    const page = await show(pages.panel);
    await page.press('Ask Proof Verifier');

    await page.run(() => vi.advanceTimersByTime(4 * 60_000));
    expect(page.text()).toContain('The Proof Verifier has the evidence in Rovo chat.');
    expect(count(world().calls, 'getContract')).toBe(1 + 30);

    await page.run(() => vi.advanceTimersByTime(2 * 60_000));
    expect(page.text()).toContain('1 piece of evidence waits for a check.');
    const calls = world().calls.length;
    await page.run(() => vi.advanceTimersByTime(60_000));
    expect(world().calls).toHaveLength(calls);
  });

  it('says so when Rovo chat does not open', async () => {
    onWorkItem().rovoOpenFails = true;
    await contractWithAgentEvidence();
    const page = await show(pages.panel);
    await page.press('Ask Proof Verifier');
    expect(page.text()).toContain('Rovo chat did not open from here. Open Rovo chat yourself and choose the Proof Verifier agent.');
    expect(page.text()).toContain('1 piece of evidence waits for a check.');
  });

  it('leaves the Proof Verifier out where Rovo is off', async () => {
    onWorkItem().rovoEnabled = false;
    await contractWithAgentEvidence();
    const page = await show(pages.panel);
    expect(page.buttons()).not.toContain('Ask Proof Verifier');
    expect(page.buttons()).toContain('Review');
  });

  it('lets a person accept what their own agent submitted', async () => {
    onWorkItem();
    await contractWithAgentEvidence();
    const page = await show(pages.panel);

    await page.press('Review');
    expect(page.dialog.text()).toContain('Review evidence');
    expect(page.dialog.text()).toContain('Test run. Submitted by the agent claude-code');
    expect(page.dialog.text()).toContain('120 tests passed.');
    expect(page.dialog.buttons()).toEqual(['Cancel', 'Reject', 'Accept']);

    await page.dialog.press('Accept');
    expect(page.all('Modal')).toHaveLength(0);
    expect(page.labels('Lozenge')).toEqual(['Partly proven', 'Proven', 'Accepted', 'No evidence', 'No evidence']);
    expect(page.text()).toContain('Not ready to close. 2 of 3 criteria are not proven (2 with no evidence).');
  });

  it('asks for a reason before it rejects', async () => {
    onWorkItem();
    await contractWithAgentEvidence();
    const page = await show(pages.panel);

    await page.press('Review');
    await page.dialog.press('Reject');
    expect(page.dialog.text()).toContain('Say why this evidence does not prove the criterion.');
    expect(world().calls).not.toContain('recordVerdict');

    await page.dialog.type('verdict-reason', 'The run is from another branch.');
    await page.dialog.press('Reject');
    expect(page.all('Modal')).toHaveLength(0);
    expect(page.labels('Lozenge')).toEqual(['Not proven', 'Evidence rejected', 'Rejected', 'No evidence', 'No evidence']);
    expect(page.text()).toContain('just now. The run is from another branch.');
  });

  it('checks evidence entered by hand before it stores it, and leaves the verdict to someone else', async () => {
    onWorkItem();
    await contract();
    const page = await show(pages.panel);

    await page.press('Add evidence');
    expect(page.dialog.text()).toContain('Login works with email and password');
    await page.dialog.press('Add evidence');
    expect(page.dialog.text()).toContain('Choose what kind of evidence this is.');

    await page.dialog.pick('evidence-kind', 'test_run');
    await page.dialog.type('evidence-summary', 'Full unit suite on the login branch');
    await page.dialog.type('evidence-passed', '118');
    await page.dialog.type('evidence-failed', '2');
    await page.dialog.press('Add evidence');
    expect(page.dialog.text()).toContain('This would not count as evidence yet');
    expect(page.dialog.text()).toContain('2 tests failed, so this run proves nothing yet.');
    expect(world().calls).not.toContain('submitEvidence');

    await page.dialog.type('evidence-failed', '0');
    await page.dialog.type('evidence-command', 'npm test');
    await page.dialog.press('Add evidence');
    expect(page.all('Modal')).toHaveLength(0);
    expect(page.text()).toContain('Added by hand, just now');
    expect(page.text()).toContain('118 passed, 0 failed');
    expect(page.text()).toContain('Command: npm test');
    expect(page.text()).toContain('You added this evidence, so someone else has to accept it.');
    expect(page.buttons()).not.toContain('Review');

    // A second person opens the panel.
    world().accountId = 'bob';
    await page.press('Refresh');
    await page.press('Review');
    await page.dialog.press('Accept');
    expect(page.labels('Lozenge')).toEqual(['Partly proven', 'Proven', 'Accepted', 'No evidence', 'No evidence']);
  });

  it('shows a pasted excerpt with its line breaks and folds a long one', async () => {
    const log = Array.from({ length: 8 }, (_, index) => `deploy step ${index + 1} ok`).join('\n');
    onWorkItem();
    await contract();
    const page = await show(pages.panel);

    await page.press('Add evidence');
    await page.dialog.pick('evidence-kind', 'other');
    await page.dialog.type('evidence-summary', 'The end of the deploy log on staging');
    await page.dialog.type('evidence-text', log);
    await page.dialog.press('Add evidence');
    expect(page.all('CodeBlock').map((block) => block.props['text'])).toEqual([log.split('\n').slice(0, 6).join('\n')]);

    await page.press('Show the whole excerpt');
    expect(page.all('CodeBlock')[0]!.props).toMatchObject({ text: log, showLineNumbers: false, shouldWrapLongLines: true });
    await page.press('Show less of the excerpt');

    // The review dialog shows all of it, because the reviewer has to read it.
    world().accountId = 'bob';
    await page.press('Refresh');
    await page.press('Review');
    expect(page.dialog.all('CodeBlock').map((block) => block.props['text'])).toEqual([log]);
    expect(page.dialog.buttons()).toEqual(['Cancel', 'Reject', 'Accept']);
  });

  it('starts the form on the kind the wording suggests, and locks it when the criterion needs one kind', async () => {
    onWorkItem();
    const created = await contract();
    await elsewhere().replaceCriterion('MOBL-1', ALICE, created.criteria[0]!.id, { text: created.criteria[0]!.text, requiredKind: 'pull_request' });
    const page = await show(pages.panel);

    await page.press('Add evidence', 1);
    expect(page.dialog.text()).toContain('All unit tests pass');
    expect(page.dialog.field('evidence-kind').props).toMatchObject({ isDisabled: false, value: { value: 'test_run' } });
    await page.dialog.press('Cancel');
    expect(page.all('Modal')).toHaveLength(0);

    await page.press('Add evidence', 2);
    expect(page.dialog.text()).toContain('Release notes are updated');
    expect(page.dialog.field('evidence-kind').props).toMatchObject({ value: { value: 'document' } });
    await page.dialog.press('Cancel');

    await page.press('Add evidence', 0);
    expect(page.dialog.field('evidence-kind').props).toMatchObject({ isDisabled: true, value: { value: 'pull_request' } });
    expect(page.dialog.text()).toContain('This criterion only takes a pull request.');
    await page.dialog.type('evidence-summary', 'Adds the email and password form to the login screen');
    await page.dialog.type('evidence-url', 'https://example.com/login');
    await page.dialog.press('Add evidence');
    expect(page.dialog.text()).toContain('The link does not look like a pull request.');

    await page.dialog.type('evidence-url', 'https://github.com/example/shop/pull/7');
    await page.dialog.pick('evidence-state', 'merged');
    await page.dialog.press('Add evidence');
    expect(page.all('Modal')).toHaveLength(0);
    expect(page.labels('Lozenge').slice(0, 4)).toEqual(['Not proven', 'Waiting for a check', 'Needs a pull request', 'Waiting for a check']);
    expect(page.text()).toContain('Result: merged');
  });

  it('counts an attestation by the assignee as a self-review', async () => {
    onWorkItem({ assigneeAccountId: 'alice' });
    await contract();
    const page = await show(pages.panel);

    await page.press('Add evidence', 2);
    await page.dialog.pick('evidence-kind', 'attestation');
    expect(page.dialog.text()).toContain('An attestation is your own word.');
    await page.dialog.type('evidence-summary', 'I read the published notes and the login change is in them.');
    await page.dialog.press('Add evidence');
    expect(page.text()).toContain('Attested by the assignee of this work item.');
    expect(page.labels('Lozenge')).toEqual(['Not proven', 'No evidence', 'No evidence', 'Needs a second person', 'Self-reviewed']);
    expect(page.text()).toContain('1 piece of evidence waits for a check.');
  });

  it('lets a team of one review its own evidence and says that it did', async () => {
    const fresh = onWorkItem();
    await fresh.store.saveSettings('10000', { ...DEFAULT_SETTINGS, requireIndependent: false });
    const created = await contract();
    await elsewhere().submitEvidence('MOBL-1', ALICE, { criterionId: created.criteria[0]!.id, ...TEST_RUN });
    const page = await show(pages.panel);

    await page.press('Review');
    await page.dialog.press('Accept');
    expect(page.labels('Lozenge')).toEqual(['Partly proven', 'Proven, self-reviewed', 'Self-reviewed', 'No evidence', 'No evidence']);
  });

  it('changes and removes a criterion, and keeps both in the history', async () => {
    onWorkItem();
    await contractWithAgentEvidence();
    const page = await show(pages.panel);

    await page.press('Edit');
    expect(page.dialog.text()).toContain('This criterion has evidence. Changing or removing it retires that evidence');
    await page.dialog.type('criterion-text', 'Login works with email, password and a passkey');
    await page.dialog.press('Save');
    expect(page.all('Modal')).toHaveLength(0);
    expect(page.text()).toContain('Login works with email, password and a passkey');
    expect(page.text()).not.toContain('Submitted by the agent');
    // The old wording was changed on purpose, so the panel does not offer it again.
    expect(page.buttons()).not.toContain('Add it');

    await page.press('Edit', 1);
    await page.dialog.press('Remove');
    expect(page.text()).toContain('0 of 2 criteria proven');
    expect(page.text()).not.toContain('All unit tests pass');

    await page.press('History');
    const history = page.dialog.text();
    expect(history).toContain('Proof history of MOBL-1');
    expect(history).toContain('created the contract with 3 criteria');
    expect(history).toContain('through an agent, just now');
    expect(history).toContain('submitted test run evidence for "Login works with email and password".');
    expect(history).toContain('changed "Login works with email and password" to "Login works with email, password and a passkey"');
    expect(history).toContain('removed the criterion "All unit tests pass"');
    await page.dialog.press('Close');
    expect(page.all('Modal')).toHaveLength(0);
  });

  it('folds away evidence beyond the newest two', async () => {
    onWorkItem();
    const created = await contract();
    for (const run of ['first', 'second', 'third']) {
      await elsewhere().submitEvidence('MOBL-1', AGENT, { criterionId: created.criteria[0]!.id, ...TEST_RUN, summary: `The ${run} run of the unit suite` });
    }
    const page = await show(pages.panel);
    expect(count(page.labels('Lozenge'), 'Waiting for a check')).toBe(1 + 2);

    await page.press('Show 1 older');
    expect(count(page.labels('Lozenge'), 'Waiting for a check')).toBe(1 + 3);
    await page.press('Show less');
    expect(page.buttons()).toContain('Show 1 older');
  });

  it('warns on a work item that was closed without proof', async () => {
    onWorkItem({ statusName: 'Done', statusCategory: 'done' });
    await contract();
    const page = await show(pages.panel);
    expect(page.text()).toContain('MOBL-1 is Done, but it is not proven');
    expect(page.text()).toContain('3 of 3 criteria are not proven (3 with no evidence).');
    expect(page.text()).not.toContain('Not ready to close.');
  });

  it('says a proven work item can close', async () => {
    onWorkItem();
    const created = await contract();
    for (const [index, criterion] of created.criteria.entries()) {
      const view = await elsewhere().submitEvidence('MOBL-1', AGENT, { criterionId: criterion.id, ...TEST_RUN });
      await elsewhere().recordVerdict('MOBL-1', BOB, { evidenceId: view.criteria[index]!.evidence[0]!.id, decision: 'accepted' });
    }
    const page = await show(pages.panel);
    expect(page.labels('Lozenge')[0]).toBe('Proven');
    expect(page.text()).toContain('All 3 criteria are proven. This work item can close.');
    expect(page.all('ProgressBar')[0]!.props).toMatchObject({ value: 1, appearance: 'success' });
    expect(page.buttons()).not.toContain('Ask Proof Verifier');
  });

  it('is read-only for someone who cannot edit the work item', async () => {
    const fresh = onWorkItem();
    await contractWithAgentEvidence();
    fresh.jira.editable = false;
    const page = await show(pages.panel);
    expect(page.text()).toContain('You can read this contract. Changing it or adding evidence needs permission to edit the work item.');
    expect(page.text()).toContain('Submitted by the agent claude-code');
    expect(page.buttons()).toEqual(['Refresh', 'History']);
  });

  it('tells someone who cannot edit the work item why there is no contract to create', async () => {
    onWorkItem().jira.editable = false;
    const page = await show(pages.panel);
    expect(page.text()).toContain('You need permission to edit this work item to create its contract.');
    expect(page.buttons()).toEqual([]);
  });

  it('says why it could not load', async () => {
    resetWorld().extension = { issue: { id: '10001' } };
    const page = await show(pages.panel);
    expect(page.text()).toContain('Proof of Done could not load');
    expect(page.text()).toContain('Work item 10001 does not exist, or you do not have access to it.');
  });

  it('keeps the details of an unexpected failure out of the page and logs them', async () => {
    onWorkItem().jira.getIssue = async () => {
      throw new Error('Jira is down');
    };
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const page = await show(pages.panel);
    expect(page.text()).toContain('Something went wrong on our side. Try again in a moment.');
    expect(page.text()).not.toContain('Jira is down');
    expect(logged).toHaveBeenCalledOnce();
  });
});

describe('the project page', () => {
  it('explains itself on a project with no contracts', async () => {
    onProject();
    const page = await show(pages.project);
    expect(page.text()).toContain('Done means proven. This page shows whether Mobile Dev is converging, and which work items still lack proof.');
    expect(page.labels('Lozenge')).toEqual(['Stalled']);
    expect(page.text()).toContain('Nothing was opened, closed or proven in the last 7 days.');
    expect(page.text()).toContain('No done contracts in this project yet');
    expect(page.text()).toContain('No work item in this project has a done contract yet.');
    expect(page.labels('Tab')).toEqual(['Work under contract', 'Settings']);
    expect(page.all('DynamicTable')).toHaveLength(0);
    expect(world().calls).toEqual(['getProject']);
  });

  it('loads the sample data in one click and removes it again', async () => {
    const fresh = onProject();
    const page = await show(pages.project);
    await page.press('Load sample data');
    expect(count(fresh.calls, 'loadSample')).toBe(SAMPLE_ITEMS.length);
    expect(page.text()).toContain('Sample data is loaded');
    expect(page.text()).toContain('4 work items have a done contract.');
    expect(page.text()).toContain('Sample: Lock an account after five failed logins');
    expect(page.all('DynamicTable')[0]!.props['rows']).toHaveLength(4);
    expect(page.labels('Lozenge')).toEqual(expect.arrayContaining(['Busy, not climbing', 'Proven', 'Partly proven', 'Not proven', 'Done', 'In Progress']));

    await page.press('Remove sample data');
    expect(page.text()).toContain('This deletes the 5 sample work items and their proof. Nothing else is touched.');
    await page.press('Keep them');
    expect(fresh.jira.issues.size).toBe(SAMPLE_ITEMS.length);

    await page.press('Remove sample data');
    await page.press('Delete them');
    expect(fresh.jira.issues.size).toBe(0);
    expect(page.text()).toContain('No done contracts in this project yet');
    expect(page.all('DynamicTable')).toHaveLength(0);
  });

  it('says which sample work items Jira would not delete', async () => {
    const fresh = onProject();
    const page = await show(pages.project);
    await page.press('Load sample data');
    fresh.jira.failDelete = true;
    await page.press('Remove sample data');
    await page.press('Delete them');
    expect(page.text()).toContain('Jira would not delete MOBL-100, MOBL-101, MOBL-102, MOBL-103, MOBL-104. Delete them in Jira, then remove the sample data again.');
    expect(page.text()).toContain('Sample data is loaded');
  });

  it('stops loading the sample when Jira refuses a work item', async () => {
    const fresh = onProject();
    fresh.jira.failCreate = 'Jira returned 400 when creating a work item.';
    const page = await show(pages.project);
    await page.press('Load sample data');
    expect(page.text()).toContain('Jira would not create a sample work item in Mobile Dev. Jira returned 400 when creating a work item.');
    expect(count(fresh.calls, 'loadSample')).toBe(1);
    expect(page.buttons()).toContain('Load sample data');
  });

  it('lists the work under contract, the work that needs attention first', async () => {
    const fresh = onProject();
    fresh.jira.add(issueInfo({ description: DESCRIPTION }));
    fresh.jira.add(issueInfo({ id: '10002', key: 'MOBL-2', summary: 'Password reset', description: DESCRIPTION, statusName: 'Done', statusCategory: 'done' }));
    const first = await contract();
    await elsewhere().submitEvidence('MOBL-1', AGENT, { criterionId: first.criteria[0]!.id, ...TEST_RUN });
    await elsewhere().createContract('MOBL-2', ALICE, { withSuggestions: true });
    const page = await show(pages.project);
    expect(page.text()).toContain('2 work items have a done contract. Work that was closed without proof comes first, then evidence that waits for a check.');
    expect(page.all('Link').map((link) => link.props['href'])).toEqual([
      'https://example.atlassian.net/browse/MOBL-2',
      'https://example.atlassian.net/browse/MOBL-1',
    ]);
    expect(page.text()).toContain('Closed without proof. 3 of 3 not proven.');
    expect(page.text()).toContain('1 waiting for a check.');
    // With contracts in the project, the sample is a quiet offer.
    expect(page.text()).toContain('Want to see every state of the app at once?');
    expect(page.buttons()).toContain('Load sample data');
  });

  it('reads the meter over another window', async () => {
    const fresh = onProject();
    const page = await show(pages.project);
    await page.pick('meter-window', '30');
    expect(page.text()).toContain('Nothing was opened, closed or proven in the last 30 days.');
    expect(page.field('meter-window').props['value']).toMatchObject({ value: '30' });
    expect(fresh.calls).toEqual(['getProject', 'getProject']);
  });

  it('saves the settings an admin changes', async () => {
    const fresh = onProject();
    const page = await show(pages.project);
    await expect(page.press('Save settings')).rejects.toThrow('disabled');

    await page.choose('gate-mode', 'bounce');
    await page.tick('Treat a work item that has no contract as not proven', true);
    expect(page.text()).toContain('You have changes that are not saved.');
    await page.press('Save settings');
    expect(page.text()).toContain('Saved.');
    expect(page.text()).not.toContain('You have changes that are not saved.');
    expect(fresh.store.settings.get('10000')).toMatchObject({ gateMode: 'bounce', enforceWithoutContract: true, requireIndependent: true });
  });

  it('adds a project rule and removes it again', async () => {
    const fresh = onProject();
    const page = await show(pages.project);
    await page.press('Add rule');
    expect(page.text()).toContain('Write the rule first (at least 3 characters).');

    await page.type('rule', 'All unit tests pass');
    await page.pick('rule-kind', 'test_run');
    await page.pick('rule-types', ['Story']);
    await page.press('Add rule');
    expect(page.text()).toContain('Needs a test run. Applies to Story.');
    await page.type('rule', 'all unit tests pass');
    await page.press('Add rule');
    expect(page.text()).toContain('This project already has that rule.');

    await page.press('Save settings');
    expect(page.text()).toContain('Saved.');
    const rules = fresh.store.settings.get('10000')!.rules;
    expect(rules).toMatchObject([{ text: 'All unit tests pass', requiredKind: 'test_run', issueTypes: ['Story'] }]);
    expect(rules[0]!.id).not.toBe('');

    await page.press('Remove');
    expect(page.text()).toContain('No rules yet.');
    await page.press('Save settings');
    expect(fresh.store.settings.get('10000')!.rules).toEqual([]);
  });

  it('shows the rules to someone who does not administer the project, with no way to change them', async () => {
    onProject().jira.admin = false;
    const page = await show(pages.project);
    expect(page.text()).toContain('A project admin can also load sample data here.');
    expect(page.text()).toContain('These are the rules of proof for Mobile Dev. Someone who administers the project can change them.');
    expect(page.field('gate-mode').props['isDisabled']).toBe(true);
    expect(page.buttons()).toEqual([]);
  });

  it('says why it could not load', async () => {
    resetWorld().extension = { project: { id: '999' } };
    const page = await show(pages.project);
    expect(page.text()).toContain('Proof of Done could not load');
    expect(page.text()).toContain('This project does not exist, or you do not have access to it.');
  });
});

describe('the project settings page', () => {
  it('shows the rules of proof and saves a change', async () => {
    const fresh = onProject();
    const page = await show(pages.settings);
    expect(page.text()).toContain("The rules of proof for Mobile Dev. The meter and the work under contract are on the project's Proof of Done page.");
    expect(page.field('gate-mode').props['value']).toBe('warn');

    await page.tick('Evidence has to be accepted by someone other than the person who entered it', false);
    await page.press('Save settings');
    expect(page.text()).toContain('Saved.');
    expect(fresh.store.settings.get('10000')).toMatchObject({ requireIndependent: false });
  });

  it('locks the rules for someone who does not administer the project', async () => {
    onProject().jira.admin = false;
    const page = await show(pages.settings);
    expect(page.text()).toContain('Someone who administers the project can change them.');
    expect(page.buttons()).toEqual([]);
  });

  it('says why it could not load', async () => {
    resetWorld();
    const page = await show(pages.settings);
    expect(page.text()).toContain('Proof of Done could not load');
    expect(page.text()).toContain('This page only works inside a project.');
  });
});
