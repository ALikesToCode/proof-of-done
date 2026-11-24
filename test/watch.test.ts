import { afterEach, describe, expect, it, vi } from 'vitest';
import { forgetWatch, recallWatch, rememberWatch } from '../src/frontend/watch';

/** A tab's session storage, as far as the watch uses it. */
function tab(): Storage {
  const held = new Map<string, string>();
  return {
    getItem: (name: string) => held.get(name) ?? null,
    setItem: (name: string, value: string) => void held.set(name, value),
    removeItem: (name: string) => void held.delete(name),
    clear: () => held.clear(),
    key: () => null,
    get length() {
      return held.size;
    },
  };
}

const NOW = 1_800_000_000_000;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the watch for the Proof Verifier', () => {
  it('is still there for a panel drawn later in the same tab', () => {
    vi.stubGlobal('sessionStorage', tab());
    rememberWatch('MOBL-1', NOW + 300_000);
    expect(recallWatch('MOBL-1', NOW + 20_000)).toBe(NOW + 300_000);
  });

  it('belongs to one work item', () => {
    vi.stubGlobal('sessionStorage', tab());
    rememberWatch('MOBL-1', NOW + 300_000);
    expect(recallWatch('MOBL-2', NOW)).toBe(0);
  });

  it('ends at its time', () => {
    vi.stubGlobal('sessionStorage', tab());
    rememberWatch('MOBL-1', NOW + 300_000);
    expect(recallWatch('MOBL-1', NOW + 300_000)).toBe(0);
  });

  it('ends when it is forgotten', () => {
    vi.stubGlobal('sessionStorage', tab());
    rememberWatch('MOBL-1', NOW + 300_000);
    forgetWatch('MOBL-1');
    expect(recallWatch('MOBL-1', NOW)).toBe(0);
  });

  it('reads anything but a time as no watch', () => {
    const storage = tab();
    vi.stubGlobal('sessionStorage', storage);
    storage.setItem('proof-of-done.watch.MOBL-1', 'soon');
    expect(recallWatch('MOBL-1', NOW)).toBe(0);
  });

  it('does without storage where the browser has none', () => {
    vi.stubGlobal('sessionStorage', undefined);
    rememberWatch('MOBL-1', NOW + 300_000);
    forgetWatch('MOBL-1');
    expect(recallWatch('MOBL-1', NOW)).toBe(0);
  });

  it('does without storage where the browser refuses it', () => {
    const refuse = (): never => {
      throw new Error('The operation is insecure.');
    };
    vi.stubGlobal('sessionStorage', { getItem: refuse, setItem: refuse, removeItem: refuse });
    rememberWatch('MOBL-1', NOW + 300_000);
    forgetWatch('MOBL-1');
    expect(recallWatch('MOBL-1', NOW)).toBe(0);
  });
});
