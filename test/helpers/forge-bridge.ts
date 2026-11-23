import { world } from './world';

/**
 * Stands in for @forge/bridge in page tests. `invoke` runs the app's real resolvers,
 * with the context Forge would give them, so a page test also covers the resolver layer.
 */

type Handler = (request: unknown, runtime: unknown) => Promise<unknown>;

let unanswered = 0;

/** True while a call to the backend has not answered yet. */
export const busy = (): boolean => unanswered > 0;

export async function invoke(name: string, payload: Record<string, unknown> = {}): Promise<unknown> {
  unanswered++;
  try {
    const { handler } = await import('../../src/resolvers');
    const current = world();
    current.calls.push(name);
    return await (handler as unknown as Handler)(
      { call: { functionKey: name, payload }, context: { extension: current.extension } },
      { principal: { accountId: current.accountId } },
    );
  } finally {
    unanswered--;
  }
}

export const events = {
  on: async (): Promise<{ unsubscribe: () => void }> => ({ unsubscribe: () => undefined }),
};

export const rovo = {
  isEnabled: async (): Promise<boolean> => world().rovoEnabled,
  open: async (payload: unknown): Promise<void> => {
    if (world().rovoOpenFails) throw new Error('Rovo chat is not available here.');
    world().rovoOpened.push(payload);
  },
};
