import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_PRIVACY_PREF,
  PRIVACY_MASK,
  PRIVACY_STORAGE_KEY,
  maskText,
  parsePrivacyPref,
  readPrivacyPref,
  relockPrivacyPref,
  togglePrivacyPref,
  writePrivacyPref,
} from './privacy';

describe('maskText', () => {
  it('hides the text only when hidden', () => {
    expect(maskText('12,50 EUR', true)).toBe(PRIVACY_MASK);
    expect(maskText('12,50 EUR', true)).not.toContain('12');
    expect(maskText('12,50 EUR', false)).toBe('12,50 EUR');
  });
});

describe('parsePrivacyPref', () => {
  it('falls back on missing or invalid data', () => {
    expect(parsePrivacyPref(null)).toEqual(DEFAULT_PRIVACY_PREF);
    expect(parsePrivacyPref('not json')).toEqual(DEFAULT_PRIVACY_PREF);
    expect(parsePrivacyPref('42')).toEqual(DEFAULT_PRIVACY_PREF);
  });
  it('reads a stored pref', () => {
    expect(parsePrivacyPref('{"enabled":true,"armed":true}')).toEqual({ enabled: true, armed: true });
  });
});

describe('toggle and relock', () => {
  it('arms the relock when turned on and keeps it when turned off', () => {
    const on = togglePrivacyPref(DEFAULT_PRIVACY_PREF);
    expect(on).toEqual({ enabled: true, armed: true });
    expect(togglePrivacyPref(on)).toEqual({ enabled: false, armed: true });
  });
  it('relocks only an armed, visible state', () => {
    expect(relockPrivacyPref({ enabled: false, armed: true })).toEqual({ enabled: true, armed: true });
    expect(relockPrivacyPref(DEFAULT_PRIVACY_PREF)).toEqual(DEFAULT_PRIVACY_PREF);
  });
});

describe('storage', () => {
  const store = new Map<string, string>();
  beforeEach(() => {
    store.clear();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    });
  });
  it('round trips through localStorage', () => {
    writePrivacyPref({ enabled: true, armed: true });
    expect(store.get(PRIVACY_STORAGE_KEY)).toContain('true');
    expect(readPrivacyPref()).toEqual({ enabled: true, armed: true });
  });
  it('survives a storage that throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    });
    expect(readPrivacyPref()).toEqual(DEFAULT_PRIVACY_PREF);
    expect(() => writePrivacyPref({ enabled: true, armed: true })).not.toThrow();
  });
});
