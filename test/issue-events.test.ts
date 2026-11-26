import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ContractService } from '../src/services/contracts';
import { REFUSES_BROKEN, REFUSES_BY_CHOICE } from '../src/services/gate';
import { deletedIssueId, validateDone } from '../src/triggers/issue-events';
import { doc, h, ul } from './helpers/adf';
import { issueInfo } from './helpers/fakes';
import { World, resetWorld } from './helpers/world';

// The triggers build their store and their Jira gateway when the module loads. These hand them the test's own.
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

describe('deletedIssueId', () => {
  it('reads the work item id from a deleted event', () => {
    expect(deletedIssueId({ eventType: 'avi:jira:deleted:issue', issue: { id: '59151', key: 'MOBL-43' } })).toBe('59151');
    expect(deletedIssueId({ issue: { id: 59151 } })).toBe('59151');
  });

  it('names no work item when the event has none', () => {
    expect(deletedIssueId({ issue: {} })).toBeNull();
    expect(deletedIssueId({ issue: { id: '' } })).toBeNull();
    expect(deletedIssueId({})).toBeNull();
    expect(deletedIssueId(null)).toBeNull();
  });
});

describe('validateDone', () => {
  // What Jira sends when someone tries a transition that carries the validator.
  const REQUEST = { issue: { id: '10001', key: 'MOBL-1' }, user: { accountId: 'bob' } };
  const REFUSAL = {
    result: false,
    errorMessage: 'Proof of Done: 2 of 2 criteria are not proven (2 with no evidence). Add or review evidence in the Proof of Done panel.',
  };
  let fresh: World;

  beforeEach(async () => {
    fresh = resetWorld();
    fresh.jira.add(issueInfo({ description: doc(h(2, 'Acceptance criteria'), ul('Login works', 'Logout works')) }));
    await new ContractService(fresh.store, fresh.jira).createContract('MOBL-1', { accountId: 'alice', via: 'ui' }, { withSuggestions: true });
  });

  it('refuses the transition of an unproven work item and records who tried', async () => {
    expect(await validateDone(REQUEST)).toEqual(REFUSAL);
    expect(fresh.store.events.at(-1)).toMatchObject({ type: 'gate.blocked', actorAccountId: 'bob' });
  });

  it('refuses it all the same when the refusal cannot be stored', async () => {
    fresh.store.insertEvent = async () => {
      throw new Error('The storage of this installation is full.');
    };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(await validateDone(REQUEST)).toEqual(REFUSAL);
    expect(warn).toHaveBeenCalledWith('Proof of Done: could not record the refusal for MOBL-1. Error: The storage of this installation is full.');
  });

  it('refuses the transition when the app cannot work out its answer', async () => {
    fresh.store.getBundle = async () => {
      throw new Error('The database did not answer.');
    };
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(await validateDone(REQUEST)).toEqual({
      result: false,
      errorMessage: `Proof of Done: The app's storage did not answer, so it could not check MOBL-1. ${REFUSES_BY_CHOICE}`,
    });
    expect(logged).toHaveBeenCalledWith('Proof of Done: the validator could not read the contract of MOBL-1. Error: The database did not answer.');
  });

  it('refuses the transition when the check itself breaks', async () => {
    // Nothing the gate plans for: the store hands back something that is not a contract.
    fresh.store.getBundle = async () => ({ contract: null }) as never;
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(await validateDone(REQUEST)).toEqual({ result: false, errorMessage: REFUSES_BROKEN });
    expect(logged.mock.calls[0]![0]).toMatch(/^Proof of Done: the validator failed for MOBL-1 and refused the transition\. TypeError/);
  });

  it('asks the store by the id in the request when Jira does not answer', async () => {
    fresh.jira.getIssue = async () => {
      throw new Error('Jira returned 500 when reading work item MOBL-1.');
    };
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const answer = await validateDone(REQUEST);
    expect(answer.errorMessage).toBe(`Proof of Done: Jira did not answer the app, so it could not check MOBL-1. ${REFUSES_BY_CHOICE}`);
    // The contract named the project, so the refusal is in the work item's history.
    expect(fresh.store.events.at(-1)).toMatchObject({ type: 'gate.blocked', issueId: '10001', projectId: '10000', data: { unchecked: true, why: 'jira' } });
  });

  it('lets a work item that is being created through, because it has no key yet', async () => {
    expect(await validateDone({ issue: {}, user: { accountId: 'bob' } })).toEqual({ result: true });
  });
});
