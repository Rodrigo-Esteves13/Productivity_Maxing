import { FinanceEntryKind, FinanceFrequency } from '@prisma/client';
import { parseDateKey } from '../common/date-key.util';
import {
  bucketize,
  materialize,
  monthlyCostCents,
  topCategories,
  type EntryRow,
} from './finance-analytics.util';

const entry = (over: Partial<EntryRow>): EntryRow => ({
  id: 'e',
  kind: FinanceEntryKind.EXPENSE,
  amountCents: 1000,
  category: 'FOOD',
  note: null,
  date: parseDateKey('2026-10-01'),
  recurring: false,
  frequency: null,
  payDayRule: null,
  payDay: null,
  endDate: null,
  accountId: null,
  ...over,
});

const d = parseDateKey;

describe('materialize', () => {
  it('flags occurrences after today as projected', () => {
    const occ = materialize(
      [entry({ id: 'rent', frequency: FinanceFrequency.MONTHLY })],
      d('2026-10-01'),
      d('2026-12-01'),
      d('2026-10-15'),
    );
    expect(occ.map((o) => [o.date, o.projected])).toEqual([
      ['2026-10-01', false],
      ['2026-11-01', true],
    ]);
  });
});

describe('bucketize', () => {
  const occ = materialize(
    [
      entry({
        id: 'a',
        date: d('2026-10-05'),
        category: 'CAFE',
        amountCents: 300,
      }),
      entry({ id: 'b', date: d('2026-10-11'), category: 'FOOD' }),
      entry({
        id: 'c',
        date: d('2026-10-12'),
        kind: FinanceEntryKind.INCOME,
        amountCents: 5000,
        category: 'SALARY',
      }),
    ],
    d('2026-10-01'),
    d('2026-11-01'),
    d('2026-10-31'),
  );

  it('groups by ISO week starting monday, clipping the edges', () => {
    const weeks = bucketize(occ, d('2026-10-01'), d('2026-10-15'), 'week');
    expect(weeks.map((w) => [w.key, w.start, w.end])).toEqual([
      ['2026-09-28', '2026-10-01', '2026-10-04'],
      ['2026-10-05', '2026-10-05', '2026-10-11'],
      ['2026-10-12', '2026-10-12', '2026-10-14'],
    ]);
    expect(weeks[1]).toMatchObject({
      expenseCents: 1300,
      incomeCents: 0,
      netCents: -1300,
      expensesByCategory: { CAFE: 300, FOOD: 1000 },
    });
    expect(weeks[2].netCents).toBe(5000);
  });

  it('groups by month and ranks categories', () => {
    const months = bucketize(occ, d('2026-09-15'), d('2026-11-01'), 'month');
    expect(months.map((m) => m.key)).toEqual(['2026-09', '2026-10']);
    expect(months[1].expenseCents).toBe(1300);
    expect(topCategories(months)).toEqual([
      { category: 'FOOD', expenseCents: 1000, sharePercent: 76.92 },
      { category: 'CAFE', expenseCents: 300, sharePercent: 23.08 },
    ]);
  });
});

describe('monthlyCostCents', () => {
  it('normalises weekly and yearly costs to a month', () => {
    expect(monthlyCostCents(1299, FinanceFrequency.MONTHLY)).toBe(1299);
    expect(monthlyCostCents(1200, FinanceFrequency.YEARLY)).toBe(100);
    expect(monthlyCostCents(300, FinanceFrequency.WEEKLY)).toBe(1300);
  });
});
