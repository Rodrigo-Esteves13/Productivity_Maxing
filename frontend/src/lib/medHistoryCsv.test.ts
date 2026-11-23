import { describe, expect, it } from 'vitest';
import { dayPercent, medHistoryToCsv } from './medHistoryCsv';
import type { MedicationHistory } from '../types/models';

const history: MedicationHistory = {
  from: '2026-10-01',
  to: '2026-10-02',
  days: [
    { date: '2026-10-01', scheduled: 2, taken: 1 },
    { date: '2026-10-02', scheduled: 0, taken: 0 },
  ],
  medications: [],
  totals: { scheduled: 2, taken: 1, asNeeded: 0 },
};

describe('medHistoryToCsv', () => {
  it('writes header and one row per day', () => {
    const csv = medHistoryToCsv(history, { date: 'Date', scheduled: 'Planned', taken: 'Taken' });
    expect(csv).toBe('Date,Planned,Taken\n2026-10-01,2,1\n2026-10-02,0,0\n');
  });

  it('escapes labels with commas', () => {
    const csv = medHistoryToCsv(history, { date: 'Day, date', scheduled: 'P', taken: 'T' });
    expect(csv.startsWith('"Day, date",P,T\n')).toBe(true);
  });
});

describe('dayPercent', () => {
  it('is null without planned doses and capped at 100', () => {
    expect(dayPercent(0, 0)).toBeNull();
    expect(dayPercent(3, 2)).toBe(100);
    expect(dayPercent(1, 2)).toBe(50);
  });
});
