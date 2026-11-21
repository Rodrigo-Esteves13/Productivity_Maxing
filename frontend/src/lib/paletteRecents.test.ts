import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addRecent,
  clearRecents,
  isGoneError,
  LEGACY_RECENTS_STORAGE_KEY,
  loadRecents,
  MAX_RECENTS,
  parseRecents,
  recentPath,
  recentsStorageKey,
  recordRecent,
  removeRecent,
  removeRecentFrom,
  type RecentEntry,
} from './paletteRecents';

const entry = (id: string, kind: RecentEntry['kind'] = 'task'): RecentEntry => ({ kind, id, label: id });

describe('paletteRecents', () => {
  it('moves a repeated item to the front without duplicating', () => {
    const list = addRecent(addRecent([], entry('a')), entry('b'));
    const next = addRecent(list, entry('a'));
    expect(next.map((e) => e.id)).toEqual(['a', 'b']);
  });

  it('treats same id with another kind as a different item', () => {
    const next = addRecent([entry('a', 'task')], entry('a', 'notebook'));
    expect(next).toHaveLength(2);
  });

  it('caps the list', () => {
    let list: RecentEntry[] = [];
    for (let i = 0; i < MAX_RECENTS + 3; i += 1) list = addRecent(list, entry(String(i)));
    expect(list).toHaveLength(MAX_RECENTS);
    expect(list[0].id).toBe(String(MAX_RECENTS + 2));
  });

  it('returns [] for corrupt or non array json', () => {
    expect(parseRecents('{oops')).toEqual([]);
    expect(parseRecents('{"a":1}')).toEqual([]);
    expect(parseRecents(null)).toEqual([]);
  });

  it('drops malformed entries and keeps valid ones', () => {
    const raw = JSON.stringify([
      entry('a'),
      { kind: 'bogus', id: 'x' },
      { kind: 'nav', id: 3 },
      entry('a'),
      entry('b'),
    ]);
    expect(parseRecents(raw).map((e) => e.id)).toEqual(['a', 'b']);
  });

  it('ignores a stored path from older versions', () => {
    const raw = JSON.stringify([{ kind: 'task', id: 't1', path: '/evil', label: 'T' }]);
    expect(parseRecents(raw)).toEqual([{ kind: 'task', id: 't1', label: 'T' }]);
  });

  it('removes one kind+id pair only', () => {
    const list = [entry('a', 'task'), entry('a', 'notebook'), entry('b', 'task')];
    expect(removeRecentFrom(list, 'task', 'a').map((e) => `${e.kind}-${e.id}`)).toEqual(['notebook-a', 'task-b']);
  });
});

describe('recentPath', () => {
  it('rebuilds task and notebook paths from kind and id', () => {
    expect(recentPath({ kind: 'task', id: 't 1' })).toBe('/tasks?open=t%201');
    expect(recentPath({ kind: 'notebook', id: 'n1' })).toBe('/notebook?entry=n1');
  });

  it('rebuilds a turma note path only when the turma is known', () => {
    expect(recentPath({ kind: 'turmaNote', id: 'n1', parentId: 'c1' })).toMatch(/c1.*\/notes\/n1$/);
    expect(recentPath({ kind: 'turmaNote', id: 'n1' })).toBeNull();
  });

  it('leaves nav to the command list', () => {
    expect(recentPath({ kind: 'nav', id: 'nav-tasks' })).toBeNull();
  });
});

describe('isGoneError', () => {
  it('is true for 404 and 403 only', () => {
    expect(isGoneError({ response: { status: 404 } })).toBe(true);
    expect(isGoneError({ response: { status: 403 } })).toBe(true);
    expect(isGoneError({ response: { status: 500 } })).toBe(false);
    expect(isGoneError(new Error('network'))).toBe(false);
    expect(isGoneError(null)).toBe(false);
  });
});

describe('per-user storage', () => {
  let store: Map<string, string>;
  beforeEach(() => {
    store = new Map();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('keeps each account separate', () => {
    recordRecent('u1', entry('a'));
    recordRecent('u2', entry('b'));
    expect(loadRecents('u1').map((e) => e.id)).toEqual(['a']);
    expect(loadRecents('u2').map((e) => e.id)).toEqual(['b']);
    expect(store.has(recentsStorageKey('u1'))).toBe(true);
  });

  it('does nothing without a user', () => {
    recordRecent(null, entry('a'));
    expect(store.size).toBe(0);
    expect(loadRecents(undefined)).toEqual([]);
  });

  it('deletes the old global key on load and on clear', () => {
    store.set(LEGACY_RECENTS_STORAGE_KEY, JSON.stringify([entry('old')]));
    expect(loadRecents('u1')).toEqual([]);
    expect(store.has(LEGACY_RECENTS_STORAGE_KEY)).toBe(false);
    store.set(LEGACY_RECENTS_STORAGE_KEY, 'x');
    clearRecents('u1');
    expect(store.has(LEGACY_RECENTS_STORAGE_KEY)).toBe(false);
  });

  it('removes one item and clears the whole list', () => {
    recordRecent('u1', entry('a'));
    recordRecent('u1', entry('b'));
    removeRecent('u1', 'task', 'a');
    expect(loadRecents('u1').map((e) => e.id)).toEqual(['b']);
    clearRecents('u1');
    expect(loadRecents('u1')).toEqual([]);
    expect(store.has(recentsStorageKey('u1'))).toBe(false);
  });
});
