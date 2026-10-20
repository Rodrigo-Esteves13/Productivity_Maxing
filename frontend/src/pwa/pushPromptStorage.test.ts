import { afterEach, describe, expect, it, vi } from 'vitest';
import { markPushPromptAnswered, wasPushPromptAnswered } from './pushPromptStorage';

function stubStorage(store: Map<string, string>) {
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
    },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('push prompt storage', () => {
  it('asks once per account on the same device', () => {
    stubStorage(new Map());
    expect(wasPushPromptAnswered('u1')).toBe(false);
    markPushPromptAnswered('u1');
    expect(wasPushPromptAnswered('u1')).toBe(true);
    // Outra conta no mesmo browser ainda nao respondeu.
    expect(wasPushPromptAnswered('u2')).toBe(false);
  });

  it('does not ask when the answer cannot be remembered', () => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => {
          throw new Error('blocked');
        },
        setItem: () => {
          throw new Error('blocked');
        },
      },
    });
    expect(wasPushPromptAnswered('u1')).toBe(true);
    expect(() => markPushPromptAnswered('u1')).not.toThrow();
  });
});
