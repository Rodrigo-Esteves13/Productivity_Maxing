import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Task } from '../types/models';
import {
  buildDigest,
  clearSlot,
  consumeSlot,
  countOverdue,
  isSlotUsed,
  nearestExam,
} from './dailyDigest';

const NOW = new Date(2026, 10, 10, 12, 0, 0);

const task = (over: Partial<Task>): Task =>
  ({
    id: 't',
    title: 'T',
    date: '2026-11-10T00:00:00.000Z',
    progressStatus: 'PENDING',
    dateCertainty: 'EXACT',
    academicTypeIsEvent: false,
    ...over,
  }) as unknown as Task;

describe('buildDigest', () => {
  it('returns null when there is nothing to say', () => {
    expect(buildDigest({ dueToday: 0, overdue: 0, classesToday: 0, exam: null })).toBeNull();
  });

  it('uses neutral keys with placeholders for tasks', () => {
    expect(buildDigest({ dueToday: 1, overdue: 0, classesToday: 0, exam: null })).toEqual([
      { key: 'dailyDigest.tasksDue', params: { count: 1 } },
    ]);
    expect(buildDigest({ dueToday: 0, overdue: 4, classesToday: 0, exam: null })?.[0].key).toBe(
      'dailyDigest.tasksOverdue',
    );
    expect(buildDigest({ dueToday: 2, overdue: 3, classesToday: 0, exam: null })?.[0]).toEqual({
      key: 'dailyDigest.tasksBoth',
      params: { due: 2, overdue: 3 },
    });
  });

  it('orders tasks, exam, classes', () => {
    const lines = buildDigest({ dueToday: 1, overdue: 0, classesToday: 2, exam: { title: 'Maths', days: 5 } });
    expect(lines?.map((l) => l.key)).toEqual([
      'dailyDigest.tasksDue',
      'dailyDigest.examSoon',
      'dailyDigest.classes',
    ]);
  });

  it('picks exam wording by distance', () => {
    const key = (days: number) =>
      buildDigest({ dueToday: 0, overdue: 0, classesToday: 0, exam: { title: 'X', days } })?.[0].key;
    expect(key(0)).toBe('dailyDigest.examToday');
    expect(key(1)).toBe('dailyDigest.examTomorrow');
    expect(key(7)).toBe('dailyDigest.examSoon');
  });
});

describe('nearestExam and countOverdue', () => {
  it('finds days until the nearest pending exam', () => {
    const tasks = [
      task({ id: 'a', academicTypeIsEvent: true, date: '2026-11-15T00:00:00.000Z', title: 'Later' }),
      task({ id: 'b', academicTypeIsEvent: true, date: '2026-11-12T00:00:00.000Z', title: 'Sooner' }),
      task({ id: 'c', academicTypeIsEvent: false, date: '2026-11-11T00:00:00.000Z' }),
    ];
    expect(nearestExam(tasks, NOW)).toEqual({ title: 'Sooner', days: 2 });
  });

  it('ignores exams beyond the horizon', () => {
    const far = task({ academicTypeIsEvent: true, date: '2027-03-01T00:00:00.000Z' });
    expect(nearestExam([far], NOW)).toBeNull();
  });

  it('counts overdue pending tasks only', () => {
    const tasks = [
      task({ date: '2026-11-08T00:00:00.000Z' }),
      task({ date: '2026-11-08T00:00:00.000Z', progressStatus: 'COMPLETED' }),
      task({ date: '2026-11-10T00:00:00.000Z' }),
    ];
    expect(countOverdue(tasks, NOW)).toBe(1);
  });
});

describe('daily slot', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      get length() {
        return store.size;
      },
      key: (i: number) => [...store.keys()][i] ?? null,
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    });
  });

  it('is per day and prunes older days', () => {
    consumeSlot('2026-11-09');
    consumeSlot('2026-11-10');
    expect(isSlotUsed('2026-11-10')).toBe(true);
    expect(isSlotUsed('2026-11-09')).toBe(false);
    clearSlot('2026-11-10');
    expect(isSlotUsed('2026-11-10')).toBe(false);
  });
});
