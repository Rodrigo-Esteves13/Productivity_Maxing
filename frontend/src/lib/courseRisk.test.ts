import { describe, expect, it } from 'vitest';
import { formatChancePct, formatReasonParams, formatGradedWeight, hasLowConfidenceRow, hasSeriousRisk, isAssessedRow, neededSituation, splitOverviewRows } from './courseRisk';
import type { CourseRisk, CourseRiskOverviewRow, CourseRiskSummary } from '../types/models';

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

describe('overview helpers', () => {
  const baseRow = {
    areaId: 'a',
    areaName: 'A',
    colorHex: '#7c3aed',
    gradedWeightPct: 40,
  };
  const assessedRow = (over: Partial<CourseRiskOverviewRow> = {}): CourseRiskOverviewRow => ({
    ...baseRow,
    status: 'assessed',
    risk: course({}),
    passChancePct: 80,
    failChancePct: 20,
    confidence: 'high',
    ...over,
  });
  const pendingRow = (id: string): CourseRiskOverviewRow => ({
    ...baseRow,
    areaId: id,
    status: 'not_enough_data',
    risk: null,
    passChancePct: null,
    failChancePct: null,
    confidence: null,
  });

  it('isAssessedRow requires status and filled risk and chances', () => {
    expect(isAssessedRow(assessedRow())).toBe(true);
    expect(isAssessedRow(pendingRow('p'))).toBe(false);
    expect(isAssessedRow(assessedRow({ risk: null }))).toBe(false);
  });

  it('splitOverviewRows keeps the backend order within each group', () => {
    const rows = [assessedRow({ areaId: '1' }), assessedRow({ areaId: '2' }), pendingRow('3'), pendingRow('4')];
    const { assessed, notEnoughData } = splitOverviewRows(rows);
    expect(assessed.map((r) => r.areaId)).toEqual(['1', '2']);
    expect(notEnoughData.map((r) => r.areaId)).toEqual(['3', '4']);
  });

  it('hasSeriousRisk is true only with high or extreme courses', () => {
    const summary = (high: number): CourseRiskSummary => ({
      totalCourses: 3,
      assessedCourses: 3,
      highRiskCourses: high,
      mediumRiskCourses: 1,
      lowRiskCourses: 1,
      avgPassChancePct: 60,
      worst: null,
      minGradedWeightPct: 20,
    });
    expect(hasSeriousRisk(summary(0))).toBe(false);
    expect(hasSeriousRisk(summary(1))).toBe(true);
  });

  it('formatChancePct formats an integer percentage for the locale', () => {
    expect(formatChancePct(72, 'en')).toBe('72%');
    expect(formatChancePct(0, 'en')).toBe('0%');
    expect(formatChancePct(100, 'en')).toBe('100%');
  });
});

describe('formatGradedWeight', () => {
  it('floors to one decimal so 9.6 never reads as 10', () => {
    expect(formatGradedWeight(9.6, 'en')).toBe('9.6');
    expect(formatGradedWeight(9.99, 'en')).toBe('9.9');
    expect(formatGradedWeight(4.35, 'en')).toBe('4.3');
    expect(formatGradedWeight(0, 'en')).toBe('0');
  });

  it('uses the decimal separator of the language', () => {
    expect(formatGradedWeight(9.6, 'pt')).toBe('9,6');
  });
});

describe('neededSituation', () => {
  it('has a value, is closed on the continuous track, or points to another track', () => {
    expect(neededSituation(course({ neededOnRemaining: 6 }))).toBe('value');
    expect(neededSituation(course({ neededOnRemaining: null, track: 'CONTINUOUS' }))).toBe('closed');
    expect(neededSituation(course({ neededOnRemaining: null, track: 'EXAM' }))).toBe('otherTrack');
    expect(neededSituation(course({ neededOnRemaining: null, track: 'RESIT' }))).toBe('otherTrack');
  });
});

describe('hasLowConfidenceRow', () => {
  const row = (over: Partial<CourseRiskOverviewRow>): CourseRiskOverviewRow => ({
    areaId: 'a',
    areaName: 'A',
    colorHex: '#7c3aed',
    status: 'assessed',
    risk: course({}),
    passChancePct: 80,
    failChancePct: 20,
    confidence: 'high',
    gradedWeightPct: 60,
    ...over,
  });

  it('flags only assessed rows with low confidence', () => {
    expect(hasLowConfidenceRow([row({}), row({ confidence: 'medium' })])).toBe(false);
    expect(hasLowConfidenceRow([row({}), row({ confidence: 'low' })])).toBe(true);
    expect(hasLowConfidenceRow([row({ status: 'not_enough_data', risk: null, passChancePct: null, failChancePct: null, confidence: 'low' })])).toBe(false);
  });
});
