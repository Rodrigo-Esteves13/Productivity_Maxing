import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ACCOUNT_SCOPED_KEYS,
  accountStorageKey,
  claimUserStorage,
  clearUserStorage,
  findStorageEntry,
  removeAccountStorage,
  STORAGE_OWNER_KEY,
  STORAGE_REGISTRY,
} from './storageKeys';

function fakeStorage() {
  const store = new Map<string, string>();
  return {
    store,
    api: {
      get length() {
        return store.size;
      },
      key: (i: number) => [...store.keys()][i] ?? null,
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    },
  };
}

const DEVICE = ['pmaxing-language', 'accent-color', 'accessibility-prefs', 'pm_cookie_notice_dismissed', 'pm-daily-digest-enabled', 'pmaxing.finance.privacy'];
const KEPT = [
  'pm-task-templates',
  'dashboard-saved-filter-views',
  'pm-grade-targets',
  'pm-area-order',
  'pmaxing.bestStreak',
  'pm-quiz-session',
  'pm-quiz-cards-sent',
  'pm-quiz-last-wrong',
  'pm-quiz-last-exam',
  'pm-quiz-focus-optout',
  'pm-quiz-focus-session',
];
const CACHE = [
  'palette-recents',
  'palette-recents:u1',
  'pmaxing-pad-recents',
  'pmaxing-quick-add-last-area',
  'pmaxing-notebook-area',
  'pmaxing:focus-plan:s1',
  'pmaxing:focus-break',
  'pmaxing.earnedBadges',
  'pm-daily-digest-2026-11-24',
  'pmaxing:lastOverdueCheckDate',
];
const PER_USER = ['greeting-prefs:u1', 'pmaxing:lastOverdueCheckDate:u1', 'pm-push-prompt-answered:u1'];
const SESSION_CACHE = ['pmaxing:pending-notebook-entry'];
// Trabalho irrecuperavel: fica no logout, sai quando entra outra conta.
const SESSION_DRAFT = 'pmaxing:notebook-unsaved:e1';

let local = fakeStorage();
let session = fakeStorage();

beforeEach(() => {
  local = fakeStorage();
  session = fakeStorage();
  vi.stubGlobal('localStorage', local.api);
  vi.stubGlobal('sessionStorage', session.api);
  for (const key of [...DEVICE, ...KEPT, ...CACHE, ...PER_USER, 'greeting-prefs:u2', 'someone-else']) local.store.set(key, '1');
  for (const key of [...SESSION_CACHE, SESSION_DRAFT]) session.store.set(key, '1');
});

afterEach(() => vi.unstubAllGlobals());

const has = (key: string) => local.store.has(key);

describe('storage cleanup', () => {
  it('logout removes the user cache, nothing else', () => {
    clearUserStorage();
    expect(CACHE.filter(has)).toEqual([]);
    expect(SESSION_CACHE.filter((key) => session.store.has(key))).toEqual([]);
    const survivors = [...DEVICE, ...KEPT, ...PER_USER, 'greeting-prefs:u2', 'someone-else'];
    expect(survivors.filter((key) => !has(key))).toEqual([]);
  });

  it('logout keeps the unsaved notebook text and the quiz in progress', () => {
    claimUserStorage('u1');
    clearUserStorage();
    expect(has('pm-quiz-session:u1')).toBe(true);
    expect(session.store.has(SESSION_DRAFT)).toBe(true);
  });

  it('logout then another account removes those drafts', () => {
    claimUserStorage('u1');
    session.store.set(SESSION_DRAFT, '1');
    clearUserStorage();
    claimUserStorage('u2');
    expect(session.store.has(SESSION_DRAFT)).toBe(false);
  });

  it('deleting the account also removes its own keys, not other accounts or unscoped data', () => {
    removeAccountStorage('u1');
    expect([...CACHE, ...PER_USER].filter(has)).toEqual([]);
    expect([...session.store.keys()]).toEqual([]);
    expect([...DEVICE, ...KEPT, 'greeting-prefs:u2'].filter((key) => !has(key))).toEqual([]);
  });

  it('the same account keeps its drafts; another account does not inherit them', () => {
    claimUserStorage('u1');
    session.store.set(SESSION_DRAFT, '1');
    claimUserStorage('u1');
    expect(session.store.has(SESSION_DRAFT)).toBe(true);
    claimUserStorage('u2');
    expect(session.store.has(SESSION_DRAFT)).toBe(false);
    // A tentativa de quiz fica na conta que a comecou; a outra nao a ve.
    expect(has('pm-quiz-session:u1')).toBe(true);
    expect(accountStorageKey(ACCOUNT_SCOPED_KEYS.quizSession)).toBe('pm-quiz-session:u2');
    expect(has('pm-quiz-session:u2')).toBe(false);
    expect(has('pm-task-templates:u1')).toBe(true);
    expect(has('greeting-prefs:u1')).toBe(true);
  });

  it('moves unscoped data to the first account, which the next one cannot see', () => {
    for (const key of Object.values(ACCOUNT_SCOPED_KEYS)) local.store.set(key, key);
    claimUserStorage('u1');
    for (const key of Object.values(ACCOUNT_SCOPED_KEYS)) {
      expect(local.store.get(accountStorageKey(key))).toBe(key);
      expect(has(key)).toBe(false);
    }
    clearUserStorage();
    claimUserStorage('u2');
    for (const key of Object.values(ACCOUNT_SCOPED_KEYS)) {
      expect(local.store.get(accountStorageKey(key))).toBeUndefined();
      expect(local.store.get(`${key}:u1`)).toBe(key);
    }
  });

  it('gives unscoped data to the previous account when another one signs in', () => {
    local.store.set(STORAGE_OWNER_KEY, 'u1');
    claimUserStorage('u2');
    expect(has('pm-task-templates:u1')).toBe(true);
    expect(has('pm-task-templates:u2')).toBe(false);
  });

  it('never overwrites what the account already has', () => {
    local.store.set('pm-task-templates:u1', 'mine');
    claimUserStorage('u1');
    expect(local.store.get('pm-task-templates:u1')).toBe('mine');
    expect(has('pm-task-templates')).toBe(true);
  });

  it('keeps unscoped data when it cannot be copied', () => {
    local.store.set(STORAGE_OWNER_KEY, 'u1');
    vi.stubGlobal('localStorage', {
      ...local.api,
      setItem: () => {
        throw new Error('quota');
      },
    });
    claimUserStorage('u1');
    expect(has('pm-task-templates')).toBe(true);
    expect(has('pm-task-templates:u1')).toBe(false);
  });

  it('deleting the account removes its scoped data only', () => {
    local.store.set('pm-task-templates:u1', '1');
    local.store.set('pm-task-templates:u2', '1');
    removeAccountStorage('u1');
    expect(has('pm-task-templates:u1')).toBe(false);
    expect(has('pm-task-templates:u2')).toBe(true);
  });

  it('does not throw when storage is blocked', () => {
    vi.stubGlobal('localStorage', undefined);
    vi.stubGlobal('sessionStorage', undefined);
    expect(() => removeAccountStorage('u1')).not.toThrow();
    expect(() => claimUserStorage('u1')).not.toThrow();
  });
});

describe('storage registry', () => {
  it('has no duplicate entries', () => {
    const ids = STORAGE_REGISTRY.map((e) => `${e.key}|${Boolean(e.prefix)}|${Boolean(e.session)}`);
    expect(new Set(ids).size).toBe(ids.length);
  });

  // Qualquer constante de chave num ficheiro que usa o armazenamento do browser
  // tem de estar classificada no registo.
  it('classifies every storage key declared in the source', () => {
    const sources = import.meta.glob(['../**/*.{ts,tsx}', '!../**/*.test.*', '!../i18n/messages/**'], {
      query: '?raw',
      import: 'default',
      eager: true,
    }) as Record<string, string>;
    const declaration = /const\s+(?:[A-Z_]*_)?(?:KEY|KEY_PREFIX)\s*=\s*'([^']+)'/g;
    const missing: string[] = [];
    let seen = 0;
    for (const [file, text] of Object.entries(sources)) {
      if (!/\b(?:local|session)Storage\b/.test(text)) continue;
      for (const match of text.matchAll(declaration)) {
        seen += 1;
        const key = match[1];
        // Valores em maiusculas sao codigos de dominio, nao chaves do browser.
        if (key === key.toUpperCase()) continue;
        const known = STORAGE_REGISTRY.some((e) => e.key === key || e.key === `${key}:`) || findStorageEntry(key);
        if (!known) missing.push(`${file}: ${key}`);
      }
    }
    expect(seen).toBeGreaterThan(30);
    expect(missing).toEqual([]);
  });
});
