import { describe, expect, it } from 'vitest';
import { gradeImprovements } from './gradeImprovement';
import type { CreditsAreaSummary } from '../types/models';

const area = (id: string, average: number | null, credits: number | null, passed = true): CreditsAreaSummary => ({
  areaId: id,
  areaName: id,
  credits,
  average,
  passed,
});

describe('gradeImprovements', () => {
  it('weights the gain by credits over the graded credits', () => {
    const rows = gradeImprovements([area('A', 12, 6), area('B', 14, 6)], 20);
    expect(rows.find((r) => r.areaId === 'A')?.gains).toEqual([0.5, 1]);
  });

  it('sorts by the biggest gain first', () => {
    const rows = gradeImprovements([area('small', 10, 3), area('big', 10, 9)], 20);
    expect(rows.map((r) => r.areaId)).toEqual(['big', 'small']);
  });

  it('caps the grade at the scale maximum', () => {
    const rows = gradeImprovements([area('A', 19.5, 6)], 20);
    expect(rows[0].gains).toEqual([0.5, 0.5]);
  });

  it('skips failed, ungraded and perfect courses', () => {
    const rows = gradeImprovements([area('F', 8, 6, false), area('N', null, 6), area('P', 20, 6), area('ok', 12, 6)], 20);
    expect(rows.map((r) => r.areaId)).toEqual(['ok']);
  });

  it('counts a course without credits with weight 1', () => {
    const rows = gradeImprovements([area('A', 10, null), area('B', 10, null)], 20);
    expect(rows[0].gains).toEqual([0.5, 1]);
  });

  it('skips zero-credit courses and never gives a negative gain', () => {
    const rows = gradeImprovements([area('Z', 12, 0), area('hi', 21, 6), area('ok', 12, 6)], 20);
    expect(rows.map((r) => r.areaId)).toEqual(['ok']);
  });

  it('returns nothing when no course has a grade', () => {
    expect(gradeImprovements([area('A', null, 6)], 20)).toEqual([]);
  });
});
