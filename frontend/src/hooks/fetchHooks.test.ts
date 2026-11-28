// F-19, F-27, F-28, F-33: comportamento dos hooks de fetch. Escritos antes de
// passarem a partilhar useFetch / useActivePeriodResource.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '../test/hookHarness';

vi.mock('react', async (importOriginal) =>
  (await import('../test/hookHarness')).reactShim(await importOriginal()),
);

const api = vi.hoisted(() => ({
  getSessionHistory: vi.fn(),
  getStudyHeatmap: vi.fn(),
  getDistractionStats: vi.fn(),
  getStudyVsClass: vi.fn(),
  getWeightBudget: vi.fn(),
  getWeightBudgets: vi.fn(),
  getCourseRiskOverview: vi.fn(),
  getRatingStats: vi.fn(),
  getTurma: vi.fn(),
  getAnnouncements: vi.fn(),
  getTurmaNotes: vi.fn(),
  getTurmaFiles: vi.fn(),
  getTurmaPacks: vi.fn(),
  getLinkedAreas: vi.fn(),
}));
const academic = vi.hoisted(() => ({
  value: {
    activePeriod: { id: 'p1', startDate: '2026-09-01', endDate: '2027-01-31' } as
      | { id: string; startDate: string; endDate: string }
      | null,
    isViewingAllPeriods: false,
    isViewingAllPrograms: false,
    isLoading: false,
  },
}));

vi.mock('../api/studySessionsService', () => api);
vi.mock('../api/scheduleService', () => api);
vi.mock('../api/gradeComponentsService', () => api);
vi.mock('../api/courseRiskService', () => api);
vi.mock('../api/areaRatingsService', () => api);
vi.mock('../api/turmasService', () => api);
vi.mock('../context/useAcademic', () => ({ useAcademic: () => academic.value }));
vi.mock('../i18n/translate', () => ({ translateNow: (key: string) => key }));
vi.mock('./useVersionedDoc', () => ({ useVersionedDoc: vi.fn() }));

import { useBestTimesHeatmap } from './useBestTimesHeatmap';
import { useCourseRiskOverview } from './useCourseRiskOverview';
import { useDistractionStats } from './useDistractionStats';
import { useLoadOnce } from './useLoadOnce';
import { useRatingStats } from './useRatingStats';
import { useSessionHistory } from './useSessionHistory';
import { useStudyVsClass } from './useStudyVsClass';
import { useTurmaAnnouncements, useTurmaDetail } from './useTurmas';
import { useWeightBudget } from './useWeightBudget';
import { useWeightBudgets } from './useWeightBudgets';

// Deixa as promessas resolvidas correr.
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  for (const mock of Object.values(api)) mock.mockReset();
  academic.value = {
    activePeriod: { id: 'p1', startDate: '2026-09-01', endDate: '2027-01-31' },
    isViewingAllPeriods: false,
    isViewingAllPrograms: false,
    isLoading: false,
  };
});

describe('useLoadOnce', () => {
  it('loads, keeps data on a failed reload and calls the fetcher without arguments', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce('a').mockRejectedValueOnce(new Error('x')).mockResolvedValue('b');
    const hook = renderHook(() => useLoadOnce<string>(fetcher));
    expect(hook.current).toMatchObject({ data: null, isLoading: true, error: false });
    await settle();
    expect(hook.current).toMatchObject({ data: 'a', isLoading: false, error: false });
    expect(fetcher).toHaveBeenCalledWith();
    void hook.current.reload();
    expect(hook.current.isLoading).toBe(false);
    await settle();
    expect(hook.current).toMatchObject({ data: 'a', error: true });
    void hook.current.reload();
    await settle();
    expect(hook.current).toMatchObject({ data: 'b', error: false });
  });

  it('refetches on refreshKey, ignores the older answer and anything after unmount', async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const fetcher = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    let key = '1';
    const hook = renderHook(() => useLoadOnce<string>(fetcher, key));
    key = '2';
    hook.rerender();
    second.resolve('new');
    await settle();
    first.resolve('old');
    await settle();
    expect(hook.current.data).toBe('new');
    hook.unmount();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('keeps a stable reload', async () => {
    const fetcher = vi.fn().mockResolvedValue(1);
    const hook = renderHook(() => useLoadOnce(fetcher));
    const { reload } = hook.current;
    await settle();
    expect(hook.current.reload).toBe(reload);
  });
});

describe('useSessionHistory', () => {
  it('keeps old sessions on error and aborts when days change', async () => {
    api.getSessionHistory.mockResolvedValueOnce(['s']).mockRejectedValueOnce(new Error('x'));
    let key = 'a';
    let days = 7;
    const hook = renderHook(() => useSessionHistory(days, key));
    expect(hook.current).toMatchObject({ sessions: [], isLoading: true, error: false });
    await settle();
    key = 'b';
    hook.rerender();
    expect(hook.current.isLoading).toBe(false);
    await settle();
    expect(hook.current).toMatchObject({ sessions: ['s'], error: true });

    api.getSessionHistory.mockReturnValue(new Promise(() => {}));
    days = 14;
    hook.rerender();
    const signal = api.getSessionHistory.mock.lastCall![1] as AbortSignal;
    expect(api.getSessionHistory.mock.lastCall![0]).toBe(14);
    days = 30;
    hook.rerender();
    expect(signal.aborted).toBe(true);
  });

  it('reload resolves once the new data is in', async () => {
    api.getSessionHistory.mockResolvedValueOnce([1]).mockResolvedValueOnce([2]);
    const hook = renderHook(() => useSessionHistory(7));
    await settle();
    await hook.current.reload();
    expect(hook.current.sessions).toEqual([2]);
  });
});

describe.each([
  {
    name: 'useBestTimesHeatmap',
    mock: api.getStudyHeatmap,
    use: (key: string) => {
      const r = useBestTimesHeatmap(key);
      return { data: r.cells as unknown, isLoading: r.isLoading, error: r.error };
    },
    empty: [] as unknown,
    message: 'hook.couldNotLoadTheHeatmap',
  },
  {
    name: 'useDistractionStats',
    mock: api.getDistractionStats,
    use: (key: string) => {
      const r = useDistractionStats(key);
      return { data: r.stats as unknown, isLoading: r.isLoading, error: r.error };
    },
    empty: null as unknown,
    message: 'distractionStats.error',
  },
])('$name', ({ mock, use, empty, message }) => {
  it('refetches silently, clears the error while asking and keeps old data', async () => {
    mock.mockResolvedValueOnce([{ sessionCount: 1 }]).mockRejectedValueOnce(new Error('x'));
    let key = 'a';
    const hook = renderHook(() => use(key));
    expect(hook.current).toEqual({ data: empty, isLoading: true, error: '' });
    await settle();
    key = 'b';
    hook.rerender();
    expect(hook.current.isLoading).toBe(false);
    await settle();
    expect(hook.current).toEqual({ data: [{ sessionCount: 1 }], isLoading: false, error: message });
    mock.mockReturnValue(new Promise(() => {}));
    key = 'c';
    hook.rerender();
    expect(hook.current.error).toBe('');
    expect(mock).toHaveBeenCalledTimes(3);
  });
});

describe('useStudyVsClass', () => {
  it('asks for the active period and drops data on error', async () => {
    api.getStudyVsClass.mockResolvedValueOnce('d').mockRejectedValueOnce(new Error('x'));
    let key = 1;
    const hook = renderHook(() => useStudyVsClass(key));
    await settle();
    expect(hook.current).toEqual({ data: 'd', isLoading: false, hasError: false });
    expect(api.getStudyVsClass).toHaveBeenCalledWith('2026-09-01', '2027-01-31', expect.any(AbortSignal));
    key = 2;
    hook.rerender();
    expect(hook.current.data).toBe('d');
    await settle();
    expect(hook.current).toEqual({ data: null, isLoading: false, hasError: true });
  });
});

describe('weight budgets', () => {
  it('useWeightBudget is null without area or period, and on error', async () => {
    api.getWeightBudget.mockResolvedValueOnce('b1').mockRejectedValueOnce(new Error('x'));
    let area = '';
    const hook = renderHook(() => useWeightBudget(area, 'p1', 't1'));
    expect(hook.current).toBeNull();
    expect(api.getWeightBudget).not.toHaveBeenCalled();
    area = 'a1';
    hook.rerender();
    await settle();
    expect(hook.current).toBe('b1');
    expect(api.getWeightBudget).toHaveBeenCalledWith({ areaId: 'a1', periodId: 'p1', excludeTaskId: 't1' });
    area = '';
    hook.rerender();
    expect(hook.current).toBeNull();
    area = 'a2';
    hook.rerender();
    expect(hook.current).toBeNull();
    await settle();
    expect(hook.current).toBeNull();
  });

  it('useWeightBudgets is null without period', async () => {
    api.getWeightBudgets.mockResolvedValue('all');
    let period: string | null = null;
    const hook = renderHook(() => useWeightBudgets(period));
    expect(hook.current).toBeNull();
    expect(api.getWeightBudgets).not.toHaveBeenCalled();
    period = 'p1';
    hook.rerender();
    await settle();
    expect(hook.current).toBe('all');
    period = null;
    hook.rerender();
    expect(hook.current).toBeNull();
  });
});

interface PeriodView {
  data: unknown;
  isLoading: boolean;
  hasError: boolean;
  retry: () => void;
}

describe.each([
  {
    name: 'useCourseRiskOverview',
    mock: api.getCourseRiskOverview,
    use: () => {
      const r = useCourseRiskOverview(25);
      return { ...r, data: r.overview as unknown };
    },
    args: [{ absenceLimitPct: 25, periodId: 'p1' }, expect.any(AbortSignal)],
  },
  {
    name: 'useRatingStats',
    mock: api.getRatingStats,
    use: () => {
      const r = useRatingStats();
      return { ...r, data: r.stats as unknown };
    },
    args: ['p1', expect.any(AbortSignal)],
  },
])('$name', ({ mock, use, args }) => {
  it('loads, retries after an error and shows loading only for a new period', async () => {
    mock.mockRejectedValueOnce(new Error('x')).mockResolvedValue('d');
    const hook = renderHook<PeriodView>(use);
    await settle();
    expect(hook.current).toMatchObject({ data: null, hasError: true, isLoading: false });
    hook.current.retry();
    expect(hook.current.isLoading).toBe(true);
    await settle();
    expect(hook.current).toMatchObject({ data: 'd', hasError: false, isLoading: false });
    expect(mock).toHaveBeenLastCalledWith(...args);
    hook.current.retry();
    expect(hook.current.isLoading).toBe(false);
    await settle();
    academic.value = { ...academic.value, activePeriod: { id: 'p2', startDate: '2027-02-01', endDate: '2027-06-30' } };
    hook.rerender();
    expect(hook.current.isLoading).toBe(true);
    expect(hook.current.data).toBe('d');
  });

  it('waits for the academic context and empties without a period', async () => {
    mock.mockResolvedValue('d');
    academic.value = { ...academic.value, isLoading: true, activePeriod: null };
    const hook = renderHook<PeriodView>(use);
    expect(mock).not.toHaveBeenCalled();
    expect(hook.current.isLoading).toBe(true);
    academic.value = { ...academic.value, isLoading: false };
    hook.rerender();
    expect(mock).not.toHaveBeenCalled();
    expect(hook.current).toMatchObject({ data: null, isLoading: false, hasError: false });
  });
});

describe('turma hooks', () => {
  it('fetches by id and again only when the id changes', async () => {
    api.getTurma.mockResolvedValue('t');
    api.getAnnouncements.mockResolvedValue(['n']);
    let id = '1';
    const hook = renderHook(() => ({ detail: useTurmaDetail(id), news: useTurmaAnnouncements(id) }));
    await settle();
    hook.rerender();
    expect(api.getTurma).toHaveBeenCalledTimes(1);
    expect(api.getTurma).toHaveBeenCalledWith('1');
    expect(hook.current.detail.data).toBe('t');
    expect(hook.current.news.data).toEqual(['n']);
    id = '2';
    hook.rerender();
    expect(api.getTurma).toHaveBeenLastCalledWith('2');
  });
});
