import { describe, expect, it } from 'vitest';
import {
  GREETING_CUSTOM_MAX_LENGTH,
  MOTIVATION_VARIANT_COUNT,
  clampCustomGreeting,
  computeProgressSignals,
  dayPeriodForHour,
  daySeed,
  pickMotivation,
  pickSituation,
  pickVariantIndex,
} from './greeting';

describe('dayPeriodForHour', () => {
  it('maps hours to periods', () => {
    expect(dayPeriodForHour(5)).toBe('morning');
    expect(dayPeriodForHour(11)).toBe('morning');
    expect(dayPeriodForHour(12)).toBe('afternoon');
    expect(dayPeriodForHour(18)).toBe('evening');
    expect(dayPeriodForHour(22)).toBe('night');
    expect(dayPeriodForHour(3)).toBe('night');
  });
});

describe('daySeed / pickVariantIndex', () => {
  it('is stable per day and in range', () => {
    expect(daySeed('2026-11-08')).toBe(daySeed('2026-11-08'));
    const index = pickVariantIndex(daySeed('2026-11-08'), MOTIVATION_VARIANT_COUNT);
    expect(index).toBeGreaterThanOrEqual(0);
    expect(index).toBeLessThan(MOTIVATION_VARIANT_COUNT);
  });
  it('varies across days', () => {
    const seen = new Set<number>();
    for (let day = 10; day <= 28; day += 1) {
      seen.add(pickVariantIndex(daySeed(`2026-02-${day}`), MOTIVATION_VARIANT_COUNT));
    }
    expect(seen.size).toBeGreaterThan(1);
  });
  it('handles zero variants', () => {
    expect(pickVariantIndex(10, 0)).toBe(0);
  });
});

describe('computeProgressSignals', () => {
  // Domingo 2026-11-08: a semana comeca na segunda 2026-11-02.
  const now = new Date(2026, 10, 8, 12, 0, 0);
  const done = (date: Date) => ({ progressStatus: 'COMPLETED', completedAt: date.toISOString() });
  it('splits this week and last week', () => {
    const tasks = [
      done(new Date(2026, 10, 3, 10)),
      done(new Date(2026, 10, 7, 10)),
      done(new Date(2026, 10, 1, 10)),
      done(new Date(2026, 9, 20, 10)),
      { progressStatus: 'IN_PROGRESS', completedAt: null },
    ];
    expect(computeProgressSignals(tasks, now, 2)).toEqual({ doneThisWeek: 2, doneLastWeek: 1, overdueCount: 2 });
  });
});

describe('pickSituation', () => {
  it('prioritises overdue', () => {
    expect(pickSituation({ doneThisWeek: 5, doneLastWeek: 1, overdueCount: 1 })).toBe('overdue');
  });
  it('covers the other situations', () => {
    expect(pickSituation({ doneThisWeek: 0, doneLastWeek: 0, overdueCount: 0 })).toBe('fresh');
    expect(pickSituation({ doneThisWeek: 0, doneLastWeek: 3, overdueCount: 0 })).toBe('started');
    expect(pickSituation({ doneThisWeek: 4, doneLastWeek: 3, overdueCount: 0 })).toBe('improving');
    expect(pickSituation({ doneThisWeek: 2, doneLastWeek: 3, overdueCount: 0 })).toBe('declining');
    expect(pickSituation({ doneThisWeek: 3, doneLastWeek: 3, overdueCount: 0 })).toBe('steady');
  });
});

describe('pickMotivation', () => {
  it('is deterministic per day and exposes the count', () => {
    const signals = { doneThisWeek: 4, doneLastWeek: 1, overdueCount: 0 };
    const first = pickMotivation(signals, '2026-11-08');
    expect(pickMotivation(signals, '2026-11-08')).toEqual(first);
    expect(first.key).toMatch(/^greeting\.motivation\.improving\.\d$/);
    expect(first.params.count).toBe(4);
  });
  it('uses overdue count for overdue', () => {
    expect(pickMotivation({ doneThisWeek: 4, doneLastWeek: 1, overdueCount: 3 }, '2026-11-08').params.count).toBe(3);
  });
});

describe('clampCustomGreeting', () => {
  it('cuts to the max length', () => {
    expect(clampCustomGreeting('x'.repeat(GREETING_CUSTOM_MAX_LENGTH + 10))).toHaveLength(GREETING_CUSTOM_MAX_LENGTH);
  });
});
