import { describe, expect, it } from 'vitest';
import type { FlashcardForecast } from '../api/flashcardsService';
import {
  FLASHCARD_FORECAST_HEAVY_DAY,
  areaIdsWithCards,
  buildBars,
  busiestDay,
  dayCount,
  heavyDaysBeforeExam,
  totalInNextDays,
} from './flashcardForecast';

type Row = [number, Record<string, number>];

const make = (rows: Row[]): FlashcardForecast => ({
  days: rows.map(([total, byArea], i) => ({ date: `2026-03-${String(i + 1).padStart(2, '0')}`, total, byArea })),
  exams: [],
});

describe('flashcardForecast', () => {
  it('filters by area, missing area counts zero', () => {
    const f = make([[10, { a: 6, none: 4 }]]);
    expect(dayCount(f.days[0], null)).toBe(10);
    expect(dayCount(f.days[0], 'a')).toBe(6);
    expect(dayCount(f.days[0], 'x')).toBe(0);
  });

  it('scales bar heights to the busiest day', () => {
    const bars = buildBars(make([[10, {}], [5, {}], [0, {}]]), null);
    expect(bars.map((b) => b.heightPercent)).toEqual([100, 50, 0]);
  });

  it('all zero gives zero heights and no busiest day', () => {
    const bars = buildBars(make([[0, {}], [0, {}]]), null);
    expect(bars.every((b) => b.heightPercent === 0)).toBe(true);
    expect(busiestDay(bars)).toBeNull();
  });

  it('busiest day picks the first on ties', () => {
    const bars = buildBars(make([[3, {}], [9, {}], [9, {}]]), null);
    expect(busiestDay(bars)).toEqual({ date: '2026-03-02', count: 9 });
  });

  it('sums only the first 7 days', () => {
    const rows: Row[] = Array.from({ length: 10 }, () => [1, {}]);
    expect(totalInNextDays(buildBars(make(rows), null))).toBe(7);
  });

  it('flags heavy days 1 to 3 days before an exam only', () => {
    const heavy = FLASHCARD_FORECAST_HEAVY_DAY + 1;
    const rows: Row[] = Array.from({ length: 8 }, () => [heavy, { a: heavy }]);
    const f = make(rows);
    f.exams = [{ taskId: 't', title: 'Exam', date: '2026-03-06', areaId: 'a' }];
    const set = heavyDaysBeforeExam(f.days, f.exams, null);
    expect([...set].sort()).toEqual(['2026-03-03', '2026-03-04', '2026-03-05']);
  });

  it('does not flag at exactly the threshold', () => {
    const f = make([[FLASHCARD_FORECAST_HEAVY_DAY, {}], [0, {}]]);
    f.exams = [{ taskId: 't', title: 'E', date: '2026-03-02', areaId: 'a' }];
    expect(heavyDaysBeforeExam(f.days, f.exams, null).size).toBe(0);
  });

  it('area filter ignores exams of other areas and uses area counts', () => {
    const f = make([[100, { a: 5, b: 95 }], [0, {}]]);
    f.exams = [{ taskId: 't', title: 'E', date: '2026-03-02', areaId: 'a' }];
    expect(heavyDaysBeforeExam(f.days, f.exams, null).size).toBe(1);
    expect(heavyDaysBeforeExam(f.days, f.exams, 'a').size).toBe(0);
    expect(heavyDaysBeforeExam(f.days, f.exams, 'b').size).toBe(0);
    expect(buildBars(f, 'b')[1].examTitles).toEqual([]);
    expect(buildBars(f, 'a')[1].examTitles).toEqual(['E']);
  });

  it('lists areas with cards, biggest first', () => {
    expect(areaIdsWithCards(make([[9, { a: 2, b: 7, c: 0 }]]).days)).toEqual(['b', 'a']);
  });
});
