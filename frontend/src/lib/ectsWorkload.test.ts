import { describe, expect, it } from 'vitest';
import type { EctsWorkloadCourse } from '../types/models';
import {
  DEFAULT_HOURS_PER_CREDIT,
  MAX_HOURS_PER_CREDIT,
  MIN_HOURS_PER_CREDIT,
  barSegments,
  clampHoursPerCredit,
  computeEctsWorkload,
  elapsedFraction,
  parseStoredHoursPerCredit,
  workloadStatus,
} from './ectsWorkload';

const HOUR = 60;
const course = (areaId: string, credits: number, classH: number, studyH: number): EctsWorkloadCourse => ({
  areaId,
  name: areaId,
  credits,
  classMinutes: classH * HOUR,
  studyMinutes: studyH * HOUR,
});

describe('clampHoursPerCredit', () => {
  it('clamps to the range and defaults on NaN', () => {
    expect(clampHoursPerCredit(10)).toBe(MIN_HOURS_PER_CREDIT);
    expect(clampHoursPerCredit(99)).toBe(MAX_HOURS_PER_CREDIT);
    expect(clampHoursPerCredit(28.4)).toBe(28);
    expect(clampHoursPerCredit(Number.NaN)).toBe(DEFAULT_HOURS_PER_CREDIT);
  });
});

describe('parseStoredHoursPerCredit', () => {
  it('defaults on missing, empty, whitespace or NaN storage values', () => {
    expect(parseStoredHoursPerCredit(null)).toBe(DEFAULT_HOURS_PER_CREDIT);
    expect(parseStoredHoursPerCredit('')).toBe(DEFAULT_HOURS_PER_CREDIT);
    expect(parseStoredHoursPerCredit('   ')).toBe(DEFAULT_HOURS_PER_CREDIT);
    expect(parseStoredHoursPerCredit('abc')).toBe(DEFAULT_HOURS_PER_CREDIT);
    expect(parseStoredHoursPerCredit('NaN')).toBe(DEFAULT_HOURS_PER_CREDIT);
  });
  it('clamps valid stored numbers', () => {
    expect(parseStoredHoursPerCredit('28')).toBe(28);
    expect(parseStoredHoursPerCredit('5')).toBe(MIN_HOURS_PER_CREDIT);
    expect(parseStoredHoursPerCredit('99')).toBe(MAX_HOURS_PER_CREDIT);
  });
});

describe('elapsedFraction', () => {
  const day = (iso: string) => Date.parse(iso);
  it('uses an exclusive end (end day plus one) and clamps to 0..1', () => {
    // 10 days: 2026-01-01 .. 2026-01-10 inclusive.
    expect(elapsedFraction('2026-01-01', '2026-01-10', day('2026-01-01'))).toEqual({ kind: 'ok', fraction: 0 });
    expect(elapsedFraction('2026-01-01', '2026-01-10', day('2026-01-06'))).toEqual({ kind: 'ok', fraction: 0.5 });
    expect(elapsedFraction('2026-01-01', '2026-01-10', day('2026-01-10'))).toEqual({ kind: 'ok', fraction: 0.9 });
    expect(elapsedFraction('2026-01-01', '2026-01-10', day('2026-03-01'))).toEqual({ kind: 'ok', fraction: 1 });
  });
  it('accepts full ISO timestamps and only counts the day', () => {
    expect(elapsedFraction('2026-01-01T15:00:00.000Z', '2026-01-10T03:00:00.000Z', day('2026-01-06'))).toEqual({
      kind: 'ok',
      fraction: 0.5,
    });
  });
  it('reports a period that has not started', () => {
    expect(elapsedFraction('2026-09-01', '2026-12-31', day('2026-08-31'))).toEqual({ kind: 'notStarted' });
  });
  it('reports an invalid period (end not after start, or bad dates)', () => {
    expect(elapsedFraction('2026-01-10', '2026-01-10', day('2026-01-10'))).toEqual({ kind: 'invalid' });
    expect(elapsedFraction('2026-01-10', '2026-01-01', day('2026-01-10'))).toEqual({ kind: 'invalid' });
    expect(elapsedFraction('not a date', '2026-01-01', day('2026-01-10'))).toEqual({ kind: 'invalid' });
    expect(elapsedFraction('2026-01-01', 'nope', day('2026-01-10'))).toEqual({ kind: 'invalid' });
  });
  it('reports a missing end', () => {
    expect(elapsedFraction('2026-01-01', null, day('2026-02-01'))).toEqual({ kind: 'noEnd' });
  });
});

describe('barSegments', () => {
  it('draws 50% of expected as 50% of the bar', () => {
    // Real 50h of 100h expected: 30h classes + 20h study = 50% total, marker at 100%.
    const seg = barSegments(30, 20, 100);
    expect(seg.classPct).toBe(30);
    expect(seg.studyPct).toBe(20);
    expect(seg.classPct + seg.studyPct).toBe(50);
    expect(seg.expectedPct).toBe(100);
  });
  it('scales by real hours when above expected', () => {
    const seg = barSegments(80, 40, 60);
    expect(seg.classPct + seg.studyPct).toBeCloseTo(100);
    expect(seg.expectedPct).toBeCloseTo(50);
  });
  it('has no marker without a time scale and no division by zero', () => {
    expect(barSegments(4, 2, null)).toEqual({ classPct: (4 / 6) * 100, studyPct: (2 / 6) * 100, expectedPct: null });
    expect(barSegments(0, 0, 0)).toEqual({ classPct: 0, studyPct: 0, expectedPct: 0 });
  });
});

describe('workloadStatus', () => {
  it('uses the thresholds', () => {
    expect(workloadStatus(0.74, 0.5)).toBe('below');
    expect(workloadStatus(0.75, 0.5)).toBe('onTrack');
    expect(workloadStatus(1.25, 0.5)).toBe('onTrack');
    expect(workloadStatus(1.26, 0.5)).toBe('above');
  });
  it('is early under the minimum fraction', () => {
    expect(workloadStatus(0.1, 0.09)).toBe('early');
    expect(workloadStatus(0.1, 0.1)).toBe('below');
  });
});

describe('computeEctsWorkload', () => {
  it('computes expected and ratio, sorted ascending', () => {
    // 6 ECTS * 27 = 162h full, half elapsed = 81h expected.
    const { rows, totals } = computeEctsWorkload(
      [course('a', 6, 40, 41), course('b', 6, 10, 10), course('c', 0, 5, 5)],
      27,
      0.5,
    );
    expect(rows.map((r) => r.areaId)).toEqual(['b', 'a']);
    expect(rows[1].expectedSoFarHours).toBe(81);
    expect(rows[1].ratio).toBe(1);
    expect(rows[1].status).toBe('onTrack');
    expect(rows[0].status).toBe('below');
    expect(totals.realHours).toBe(101);
    expect(totals.expectedFullHours).toBe(324);
    expect(totals.expectedSoFarHours).toBe(162);
  });
  it('shows raw hours only without time scale', () => {
    const { rows, totals } = computeEctsWorkload([course('a', 6, 4, 2)], 27, null);
    expect(rows[0].realHours).toBe(6);
    expect(rows[0].expectedSoFarHours).toBeNull();
    expect(rows[0].status).toBeNull();
    expect(totals.ratio).toBeNull();
  });
  it('reports early status under the minimum fraction', () => {
    const { rows } = computeEctsWorkload([course('a', 6, 0, 1)], 27, 0.05);
    expect(rows[0].status).toBe('early');
  });
  it('handles zero fraction without dividing by zero', () => {
    const { rows } = computeEctsWorkload([course('a', 6, 1, 1)], 27, 0);
    expect(rows[0].ratio).toBeNull();
    expect(rows[0].status).toBe('early');
  });
});
