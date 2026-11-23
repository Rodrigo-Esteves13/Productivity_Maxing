import { describe, expect, it } from 'vitest';
import { reportCardToCsv, reportCardFileName } from './reportCardCsv';
import type { PeriodReportCard } from '../types/models';

const t = (key: string) => key;

const card = {
  periodId: 'p1',
  periodName: '1.º Semestre',
  startDate: '2026-09-01',
  endDate: null,
  average: 15.5,
  gradedTaskCount: 3,
  earnedCredits: 6,
  attemptedCredits: 12,
  areas: [
    { areaId: 'a', areaName: 'Math, Advanced', credits: 6, average: 16, passed: true },
    { areaId: 'b', areaName: '=cmd', credits: null, average: null, passed: false },
  ],
} as unknown as PeriodReportCard;

describe('reportCardToCsv', () => {
  it('writes header, rows and summary', () => {
    const lines = reportCardToCsv(card, t).trimEnd().split('\n');
    expect(lines[0]).toBe('reportCard.course,reportCard.credits,reportCard.grade,reportCard.result');
    expect(lines[1]).toBe('"Math, Advanced",6,16,reportCard.passed');
    expect(lines).toHaveLength(4);
    expect(lines[3]).toBe('reportCard.average,6,15.5,');
  });

  it('neutralizes formulas and leaves empty numbers blank', () => {
    const row = reportCardToCsv(card, t).split('\n')[2];
    expect(row.startsWith("'=cmd")).toBe(true);
    expect(row.endsWith(',,,reportCard.notPassed')).toBe(true);
  });
});

describe('reportCardFileName', () => {
  it('slugifies the period name', () => {
    expect(reportCardFileName(card)).toBe('pmaxing_report_card_1-semestre.csv');
  });
});
