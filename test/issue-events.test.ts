import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ContractService } from '../src/services/contracts';
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

  it('lets the transition through when the app cannot work out its answer', async () => {
    fresh.store.getBundle = async () => {
      throw new Error('The database did not answer.');
    };
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(await validateDone(REQUEST)).toEqual({ result: true });
    expect(logged).toHaveBeenCalledWith('Proof of Done: the validator failed for MOBL-1 and let the transition through. Error: The database did not answer.');
  });
});
