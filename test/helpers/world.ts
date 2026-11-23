import { FakeJira, MemoryStore } from './fakes';

/**
 * What the stand-ins for Forge share with a page test: the store and the Jira that
 * the resolvers talk to, who is looking at the page, and what the page asked of Rovo.
 */
export interface World {
  store: MemoryStore;
  jira: FakeJira;
  accountId: string | null;
  /** The work item or the project the page is open on, as Forge passes it to a resolver. */
  extension: Record<string, unknown>;
  siteUrl: string;
  rovoEnabled: boolean;
  /** Set to make Rovo chat refuse to open. */
  rovoOpenFails: boolean;
  /** Every payload the page handed to `rovo.open`. */
  rovoOpened: unknown[];
  /** The resolver functions the page called, in order. */
  calls: string[];
}

const fresh = (): World => ({
  store: new MemoryStore(),
  jira: new FakeJira(),
  accountId: 'alice',
  extension: {},
  siteUrl: 'https://example.atlassian.net',
  rovoEnabled: true,
  rovoOpenFails: false,
  rovoOpened: [],
  calls: [],
});

let current = fresh();

export const world = (): World => current;

export function resetWorld(): World {
  current = fresh();
  return current;
}

/**
 * An object that passes every call on to whatever `target` returns at that moment.
 * The resolvers build their store and gateway once, when the module loads. Handing
 * them one of these lets each test start with a fresh world.
 */
export function forward<T extends object>(target: () => T): T {
  return new Proxy({} as T, {
    get(_, key) {
      const owner = target() as Record<string | symbol, unknown>;
      const value = owner[key];
      return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(owner) : value;
    },
  });
}
