import { describe, expect, it } from 'vitest';
import { sortReportCardRows } from './reportCardSort';
import type { CreditsAreaSummary } from '../types/models';

const row = (areaName: string, credits: number | null, average: number | null) =>
  ({ areaId: areaName, areaName, credits, average, passed: (average ?? 0) >= 10 }) as CreditsAreaSummary;

const ROWS = [row('Maths 10', 6, 14), row('Physics', null, null), row('Maths 2', 3, 8)];
const names = (rows: CreditsAreaSummary[]) => rows.map((r) => r.areaName);

describe('sortReportCardRows', () => {
  it('keeps the original order without a sort', () => {
    expect(names(sortReportCardRows(ROWS, null, 'en'))).toEqual(['Maths 10', 'Physics', 'Maths 2']);
  });

  it('sorts names naturally', () => {
    expect(names(sortReportCardRows(ROWS, { key: 'course', direction: 'asc' }, 'en'))).toEqual([
      'Maths 2',
      'Maths 10',
      'Physics',
    ]);
  });

  it('keeps missing values last in both directions', () => {
    expect(names(sortReportCardRows(ROWS, { key: 'grade', direction: 'asc' }, 'en'))).toEqual([
      'Maths 2',
      'Maths 10',
      'Physics',
    ]);
    expect(names(sortReportCardRows(ROWS, { key: 'credits', direction: 'desc' }, 'en'))).toEqual([
      'Maths 10',
      'Maths 2',
      'Physics',
    ]);
  });
});
