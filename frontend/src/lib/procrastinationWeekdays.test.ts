import { describe, expect, it } from 'vitest';
import { computeProcrastinationWeekdays } from './procrastinationWeekdays';
import type { Task } from '../types/models';

// 2026-11-02 is a Monday (date-only tasks are UTC midnight).
function task(date: string, postponedCount: number, over: Partial<Task> = {}): Task {
  return { date, postponedCount, dateCertainty: 'EXACT', ...over } as unknown as Task;
}

describe('computeProcrastinationWeekdays', () => {
  it('week starts Monday and weights by postponedCount', () => {
    const r = computeProcrastinationWeekdays([
      task('2026-11-02T00:00:00.000Z', 4),
      task('2026-11-08T00:00:00.000Z', 2),
    ]);
    expect(r.counts[0]).toBe(4);
    expect(r.counts[6]).toBe(2);
    expect(r.total).toBe(6);
    expect(r.peaks).toEqual([0]);
  });

  it('ignores never-postponed tasks and tasks without firm dates', () => {
    const r = computeProcrastinationWeekdays([
      task('2026-11-02T00:00:00.000Z', 0),
      task('2026-11-03T00:00:00.000Z', 9, { dateCertainty: 'UNKNOWN' }),
      task('2026-11-04T00:00:00.000Z', 9, { dateCertainty: 'SURPRISE' }),
      task('2026-11-05T00:00:00.000Z', 1, { dateCertainty: 'APPROXIMATE' }),
    ]);
    expect(r.total).toBe(1);
    expect(r.counts[3]).toBe(1);
  });

  it('needs a minimum sample', () => {
    expect(computeProcrastinationWeekdays([task('2026-11-02T00:00:00.000Z', 4)]).hasEnoughData).toBe(false);
    const r = computeProcrastinationWeekdays([task('2026-11-02T00:00:00.000Z', 5)]);
    expect(r.hasEnoughData).toBe(true);
    expect(r.isEarlySignal).toBe(true);
  });

  it('is not an early signal with a large sample', () => {
    const r = computeProcrastinationWeekdays([
      task('2026-11-02T00:00:00.000Z', 10),
      task('2026-11-03T00:00:00.000Z', 6),
    ]);
    expect(r.isEarlySignal).toBe(false);
  });

  it('returns all tied peaks', () => {
    const r = computeProcrastinationWeekdays([
      task('2026-11-02T00:00:00.000Z', 3),
      task('2026-11-04T00:00:00.000Z', 3),
      task('2026-11-05T00:00:00.000Z', 1),
    ]);
    expect(r.peaks).toEqual([0, 2]);
  });

  it('reports no variation when every weekday is equal', () => {
    const days = [2, 3, 4, 5, 6, 7, 8].map((d) => task(`2026-11-0${d}T00:00:00.000Z`, 1));
    const r = computeProcrastinationWeekdays(days);
    expect(r.noVariation).toBe(true);
    expect(r.peaks).toEqual([]);
  });
});
