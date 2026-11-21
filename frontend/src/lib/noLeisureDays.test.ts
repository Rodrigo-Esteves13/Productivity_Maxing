import { describe, expect, it } from 'vitest';
import { clampNoLeisureGoal, computeNoLeisureDays, parseStoredNoLeisureGoal } from './noLeisureDays';

const occ = (date: string, category = 'LEISURE', kind: 'EXPENSE' | 'INCOME' = 'EXPENSE', entryId = date) => ({
  entryId,
  date,
  kind,
  category,
});
const ent = (id: string, date: string, recurring = false, category = 'LEISURE', frequency: 'MONTHLY' | null = null) => ({
  id,
  date,
  kind: 'EXPENSE' as const,
  category,
  recurring,
  frequency,
});
const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12);

describe('computeNoLeisureDays', () => {
  it('counts recurring occurrences as spent days', () => {
    const r = computeNoLeisureDays(
      '2026-03',
      [occ('2026-03-05', 'LEISURE', 'EXPENSE', 'r'), occ('2026-03-12', 'LEISURE', 'EXPENSE', 'r')],
      [],
      at(2026, 4, 2),
    );
    expect(r.days.filter((d) => d.status === 'spent').map((d) => d.day)).toEqual([5, 12]);
    expect(r.freeDays).toBe(29);
  });

  it('ignores non leisure and income', () => {
    const r = computeNoLeisureDays('2026-03', [occ('2026-03-05', 'FOOD'), occ('2026-03-06', 'LEISURE', 'INCOME')], [], at(2026, 4, 2));
    expect(r.freeDays).toBe(31);
    expect(r.hasData).toBe(true);
  });

  it('excludes future days in the current month', () => {
    const r = computeNoLeisureDays('2026-03', [occ('2026-03-20')], [], at(2026, 3, 10));
    expect(r.elapsedDays).toBe(10);
    expect(r.freeDays).toBe(10);
    expect(r.days[19].status).toBe('future');
  });

  it('handles month lengths', () => {
    expect(computeNoLeisureDays('2026-02', [], [], at(2026, 3, 1)).totalDays).toBe(28);
    expect(computeNoLeisureDays('2028-02', [], [], at(2028, 3, 1)).totalDays).toBe(29);
  });

  it('streak ends today when today is free', () => {
    const r = computeNoLeisureDays('2026-03', [occ('2026-03-04')], [], at(2026, 3, 8));
    expect(r.currentStreak).toBe(4);
    expect(r.bestStreak).toBe(4);
  });

  it('streak ends yesterday when today has spend', () => {
    const r = computeNoLeisureDays('2026-03', [occ('2026-03-02'), occ('2026-03-08')], [], at(2026, 3, 8));
    expect(r.currentStreak).toBe(5);
    expect(r.bestStreak).toBe(5);
  });

  it('streak is 0 when today and yesterday have spend', () => {
    const r = computeNoLeisureDays('2026-03', [occ('2026-03-07'), occ('2026-03-08')], [], at(2026, 3, 8));
    expect(r.currentStreak).toBe(0);
    expect(r.bestStreak).toBe(6);
  });

  it('best streak can be earlier than current', () => {
    const r = computeNoLeisureDays('2026-03', [occ('2026-03-08')], [], at(2026, 3, 10));
    expect(r.bestStreak).toBe(7);
    expect(r.currentStreak).toBe(2);
  });

  it('empty month has no data and all free', () => {
    const r = computeNoLeisureDays('2026-03', [], [], at(2026, 3, 5));
    expect(r.hasData).toBe(false);
    expect(r.freeDays).toBe(5);
  });

  it('does not double count and uses entries only as fallback', () => {
    const r = computeNoLeisureDays(
      '2026-03',
      [occ('2026-03-05', 'LEISURE', 'EXPENSE', 'a')],
      [ent('a', '2026-03-05'), ent('b', '2026-03-06'), ent('c', '2026-03-07', true)],
      at(2026, 4, 1),
    );
    expect(r.days.filter((d) => d.status === 'spent').map((d) => d.day)).toEqual([5, 6]);
  });

  it('treats an entry with a frequency as recurring even if the flag is off', () => {
    const r = computeNoLeisureDays('2026-03', [], [ent('f', '2026-03-07', false, 'LEISURE', 'MONTHLY')], at(2026, 4, 1));
    expect(r.days.filter((d) => d.status === 'spent')).toHaveLength(0);
  });

  it('future month has no elapsed days', () => {
    const r = computeNoLeisureDays('2026-05', [], [], at(2026, 3, 5));
    expect(r.elapsedDays).toBe(0);
    expect(r.currentStreak).toBe(0);
  });
});

describe('clampNoLeisureGoal', () => {
  it('clamps to 1..31 with default for NaN', () => {
    expect(clampNoLeisureGoal(0)).toBe(1);
    expect(clampNoLeisureGoal(99)).toBe(31);
    expect(clampNoLeisureGoal(Number.NaN)).toBe(10);
  });
});

describe('parseStoredNoLeisureGoal', () => {
  it('uses default for empty, null and non integer values', () => {
    expect(parseStoredNoLeisureGoal(null)).toBe(10);
    expect(parseStoredNoLeisureGoal('')).toBe(10);
    expect(parseStoredNoLeisureGoal('  ')).toBe(10);
    expect(parseStoredNoLeisureGoal('abc')).toBe(10);
    expect(parseStoredNoLeisureGoal('7.5')).toBe(10);
    expect(parseStoredNoLeisureGoal('-3')).toBe(10);
  });

  it('parses and clamps valid integers', () => {
    expect(parseStoredNoLeisureGoal('15')).toBe(15);
    expect(parseStoredNoLeisureGoal('0')).toBe(1);
    expect(parseStoredNoLeisureGoal('99')).toBe(31);
  });
});
