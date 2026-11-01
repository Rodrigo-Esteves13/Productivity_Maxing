import { FinanceFrequency, FinancePayDayRule } from '@prisma/client';
import { parseDateKey, toDateKey } from '../common/date-key.util';
import {
  occurrencesInRange,
  resolveFrequency,
  type RecurrenceRule,
} from './finance-schedule.util';

const rule = (over: Partial<RecurrenceRule>): RecurrenceRule => ({
  date: parseDateKey('2026-01-01'),
  frequency: FinanceFrequency.MONTHLY,
  payDayRule: null,
  payDay: null,
  endDate: null,
  ...over,
});

const keys = (r: RecurrenceRule, from: string, to: string) =>
  occurrencesInRange(r, parseDateKey(from), parseDateKey(to)).map(toDateKey);

describe('occurrencesInRange', () => {
  it('one-off entry happens once, only inside the range', () => {
    const r = rule({ date: parseDateKey('2026-03-10'), frequency: null });
    expect(keys(r, '2026-03-01', '2026-04-01')).toEqual(['2026-03-10']);
    expect(keys(r, '2026-04-01', '2026-05-01')).toEqual([]);
  });

  it('legacy recurring=true is monthly on the same day', () => {
    const r = rule({
      date: parseDateKey('2026-01-15'),
      frequency: null,
      recurring: true,
    });
    expect(resolveFrequency(r)).toBe(FinanceFrequency.MONTHLY);
    expect(keys(r, '2026-01-01', '2026-04-01')).toEqual([
      '2026-01-15',
      '2026-02-15',
      '2026-03-15',
    ]);
  });

  it('clamps day 31 to the end of short months', () => {
    const r = rule({ date: parseDateKey('2026-01-31') });
    expect(keys(r, '2026-01-01', '2026-05-01')).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
    ]);
  });

  it('FIXED_DAY 30 lands on Feb 29 in a leap year', () => {
    const r = rule({
      date: parseDateKey('2028-01-01'),
      payDayRule: FinancePayDayRule.FIXED_DAY,
      payDay: 30,
    });
    expect(keys(r, '2028-02-01', '2028-03-01')).toEqual(['2028-02-29']);
    expect(keys(r, '2027-02-01', '2027-03-01')).toEqual([]);
  });

  it('yearly on Feb 29 falls on Feb 28 outside leap years', () => {
    const r = rule({
      date: parseDateKey('2028-02-29'),
      frequency: FinanceFrequency.YEARLY,
    });
    expect(keys(r, '2028-01-01', '2031-01-01')).toEqual([
      '2028-02-29',
      '2029-02-28',
      '2030-02-28',
    ]);
  });

  it('first business day skips the weekend', () => {
    // 1 de agosto de 2026 e sabado.
    const r = rule({ payDayRule: FinancePayDayRule.FIRST_BUSINESS_DAY });
    expect(keys(r, '2026-08-01', '2026-09-01')).toEqual(['2026-08-03']);
  });

  it('first business day of next month shifts the money one month', () => {
    const r = rule({
      date: parseDateKey('2026-07-01'),
      payDayRule: FinancePayDayRule.FIRST_BUSINESS_DAY_NEXT_MONTH,
    });
    // Julho paga a 3 de agosto (segunda); agosto paga a 1 de setembro.
    expect(keys(r, '2026-07-01', '2026-10-01')).toEqual([
      '2026-08-03',
      '2026-09-01',
    ]);
    // A ocorrencia do mes anterior a `from` tambem e encontrada.
    expect(keys(r, '2026-09-01', '2026-09-02')).toEqual(['2026-09-01']);
  });

  it('last business day steps back from a weekend', () => {
    // 31 de outubro de 2026 e sabado.
    const r = rule({ payDayRule: FinancePayDayRule.LAST_BUSINESS_DAY });
    expect(keys(r, '2026-10-01', '2026-11-01')).toEqual(['2026-10-30']);
  });

  it('last friday of the month', () => {
    const r = rule({ payDayRule: FinancePayDayRule.LAST_FRIDAY });
    expect(keys(r, '2026-10-01', '2027-01-01')).toEqual([
      '2026-10-30',
      '2026-11-27',
      '2026-12-25',
    ]);
  });

  it('weekly every 7 days, honours endDate inclusive', () => {
    const r = rule({
      date: parseDateKey('2026-10-05'),
      frequency: FinanceFrequency.WEEKLY,
      endDate: parseDateKey('2026-10-26'),
    });
    expect(keys(r, '2026-10-10', '2026-12-01')).toEqual([
      '2026-10-12',
      '2026-10-19',
      '2026-10-26',
    ]);
  });

  it('never before the start date', () => {
    const r = rule({
      date: parseDateKey('2026-10-20'),
      payDayRule: FinancePayDayRule.FIRST_BUSINESS_DAY,
    });
    expect(keys(r, '2026-10-01', '2026-12-01')).toEqual(['2026-11-02']);
  });
});
