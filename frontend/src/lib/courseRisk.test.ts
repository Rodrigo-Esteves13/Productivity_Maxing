import { describe, expect, it } from 'vitest';
import { formatReasonParams, hasVisibleRisk } from './courseRisk';
import type { CourseRisk } from '../types/models';

const course = (over: Partial<CourseRisk>): CourseRisk => ({
  areaId: 'a',
  areaName: 'A',
  colorHex: '#7c3aed',
  score: 0,
  level: 'low',
  track: 'CONTINUOUS',
  reasons: [],
  currentAverage: 14,
  gradedWeightPct: 50,
  remainingWeightPct: 50,
  neededOnRemaining: 6,
  ...over,
});

describe('hasVisibleRisk', () => {
  it('hides a course with score 0, level low and no reasons', () => {
    expect(hasVisibleRisk(course({}))).toBe(false);
  });

  it('shows a course with a score, a higher level or any reason', () => {
    expect(hasVisibleRisk(course({ score: 12 }))).toBe(true);
    expect(hasVisibleRisk(course({ level: 'medium' }))).toBe(true);
    expect(
      hasVisibleRisk(course({ reasons: [{ code: 'POSTPONED_TASKS', params: { count: 3 } }] })),
    ).toBe(true);
  });
});

describe('formatReasonParams', () => {
  it('uses the decimal separator of the language and leaves text alone', () => {
    const params = { needed: 17.7, passMark: 9.5, share: 30, label: 'Exam 1.5' };
    expect(formatReasonParams(params, 'pt')).toEqual({ needed: '17,7', passMark: '9,5', share: '30', label: 'Exam 1.5' });
    expect(formatReasonParams(params, 'en')).toEqual({ needed: '17.7', passMark: '9.5', share: '30', label: 'Exam 1.5' });
  });

  it('caps the decimals', () => {
    expect(formatReasonParams({ average: 12.3456 }, 'en')).toEqual({ average: '12.35' });
  });
});
