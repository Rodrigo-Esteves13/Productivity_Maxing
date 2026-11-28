// Metas de nota, ordem das Areas e estado local dos quizzes: cada conta ve so
// o seu, e o valor antigo (sem id) passa para a ultima conta que entrou.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createBrowserStubs, renderHook } from '../test/hookHarness';

vi.mock('react', async (importOriginal) =>
  (await import('../test/hookHarness')).reactShim(await importOriginal()),
);

import { useAreaOrder } from '../hooks/useAreaOrder';
import {
  clearStoredQuizSession,
  useQuizCardsSent,
  useQuizFocusPrefs,
  useQuizLastExam,
} from '../hooks/useQuizSession';
import { loadGradeTargets, saveGradeTargets } from './gradeTargets';
import { claimUserStorage, STORAGE_OWNER_KEY } from './storageKeys';

let browser: ReturnType<typeof createBrowserStubs>;

beforeEach(() => {
  browser = createBrowserStubs();
  vi.stubGlobal('localStorage', {
    ...browser.storage,
    get length() {
      return browser.data.size;
    },
    key: (i: number) => [...browser.data.keys()][i] ?? null,
  });
  vi.stubGlobal('window', browser.window);
});

describe('account scoped local state', () => {
  it('keeps grade targets apart per account', () => {
    claimUserStorage('u1');
    saveGradeTargets({ 'area-1': '15' });
    claimUserStorage('u2');
    expect(loadGradeTargets()).toEqual({});
    claimUserStorage('u1');
    expect(loadGradeTargets()).toEqual({ 'area-1': '15' });
  });

  it('keeps the area order apart per account', () => {
    claimUserStorage('u1');
    renderHook(useAreaOrder).current.moveArea(['a', 'b'], 'b', 'a');
    claimUserStorage('u2');
    expect(renderHook(useAreaOrder).current.isCustom).toBe(false);
    claimUserStorage('u1');
    expect(renderHook(useAreaOrder).current.isCustom).toBe(true);
  });

  it('keeps quiz state apart per account', () => {
    claimUserStorage('u1');
    renderHook(() => useQuizCardsSent('q1')).current.markSent(['x']);
    renderHook(() => useQuizLastExam('q1')).current.remember(['y']);
    renderHook(() => useQuizFocusPrefs('q1')).current.setOptedOut(true);
    claimUserStorage('u2');
    expect(renderHook(() => useQuizCardsSent('q1')).current.sent).toEqual([]);
    expect(renderHook(() => useQuizLastExam('q1')).current.ids).toEqual([]);
    expect(renderHook(() => useQuizFocusPrefs('q1')).current.optedOut).toBe(false);
    claimUserStorage('u1');
    expect(renderHook(() => useQuizCardsSent('q1')).current.sent).toEqual(['x']);
    expect(renderHook(() => useQuizLastExam('q1')).current.ids).toEqual(['y']);
    expect(renderHook(() => useQuizFocusPrefs('q1')).current.optedOut).toBe(true);
  });

  it('discarding a broken session only touches the current account', () => {
    browser.data.set('pm-quiz-session:u1', 'one');
    browser.data.set('pm-quiz-session:u2', 'two');
    browser.data.set(STORAGE_OWNER_KEY, 'u2');
    clearStoredQuizSession();
    expect(browser.data.get('pm-quiz-session:u1')).toBe('one');
    expect(browser.data.has('pm-quiz-session:u2')).toBe(false);
  });

  it('migrates unscoped values to the last signed in account', () => {
    browser.data.set(STORAGE_OWNER_KEY, 'u1');
    browser.data.set('pm-grade-targets', '{"area-1":"12"}');
    browser.data.set('pm-area-order', '["b","a"]');
    browser.data.set('pm-quiz-cards-sent', '{"q1":["x"]}');
    claimUserStorage('u2');
    expect(loadGradeTargets()).toEqual({});
    expect(browser.data.get('pm-grade-targets:u1')).toBe('{"area-1":"12"}');
    expect(browser.data.get('pm-area-order:u1')).toBe('["b","a"]');
    expect(browser.data.get('pm-quiz-cards-sent:u1')).toBe('{"q1":["x"]}');
    expect(browser.data.has('pm-grade-targets')).toBe(false);
  });
});
