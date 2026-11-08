import { describe, expect, it } from 'vitest';
import { mergeRenewalOccurrences, nextSubscriptionRenewal, overdueOwed, renewalSpilloverMonth } from './moneySnapshot';
import type { FinanceOccurrence, FinanceSummary } from '../api/financeService';

const occ = (date: string, overrides: Partial<FinanceOccurrence> = {}): FinanceOccurrence => ({
  entryId: date,
  date,
  kind: 'EXPENSE',
  amountCents: 999,
  category: 'SUBSCRIPTIONS',
  note: null,
  accountId: null,
  frequency: 'MONTHLY',
  projected: true,
  reason: 'REGULAR',
  ...overrides,
});

describe('nextSubscriptionRenewal', () => {
  it('picks the earliest projected subscription inside the window', () => {
    const found = nextSubscriptionRenewal([occ('2026-11-12'), occ('2026-11-09')], '2026-11-07');
    expect(found?.date).toBe('2026-11-09');
  });

  it('includes both window edges and ignores outside, past, non subscription and income', () => {
    expect(nextSubscriptionRenewal([occ('2026-11-14')], '2026-11-07')?.date).toBe('2026-11-14');
    expect(nextSubscriptionRenewal([occ('2026-11-15')], '2026-11-07')).toBeNull();
    expect(nextSubscriptionRenewal([occ('2026-11-06')], '2026-11-07')).toBeNull();
    expect(nextSubscriptionRenewal([occ('2026-11-08', { projected: false })], '2026-11-07')).toBeNull();
    expect(nextSubscriptionRenewal([occ('2026-11-08', { category: 'FOOD' })], '2026-11-07')).toBeNull();
    expect(nextSubscriptionRenewal([occ('2026-11-08', { kind: 'INCOME' })], '2026-11-07')).toBeNull();
  });
});

describe('renewal window across a month boundary', () => {
  it('asks for the next month only when today + window crosses into it', () => {
    expect(renewalSpilloverMonth('2026-11-07')).toBeNull();
    expect(renewalSpilloverMonth('2026-11-23')).toBeNull();
    expect(renewalSpilloverMonth('2026-11-24')).toBe('2026-12');
    expect(renewalSpilloverMonth('2026-12-28')).toBe('2027-01');
    expect(renewalSpilloverMonth('2027-02-22')).toBe('2027-03');
  });

  it('finds a renewal early next month once both months are merged', () => {
    const today = '2026-11-28';
    const current = [occ('2026-11-02', { projected: false })];
    const next = [occ('2026-12-02', { note: 'Music' }), occ('2026-12-20')];
    expect(nextSubscriptionRenewal(current, today)).toBeNull();
    const found = nextSubscriptionRenewal(mergeRenewalOccurrences(current, next), today);
    expect(found?.date).toBe('2026-12-02');
    expect(found?.note).toBe('Music');
  });

  it('merges without duplicates and keeps the current list when next is missing', () => {
    const current = [occ('2026-11-30')];
    expect(mergeRenewalOccurrences(current, null)).toBe(current);
    expect(mergeRenewalOccurrences(current, [occ('2026-11-30'), occ('2026-12-01')]).map((o) => o.date)).toEqual(['2026-11-30', '2026-12-01']);
  });
});

describe('overdueOwed', () => {
  it('sums only overdue items', () => {
    const owed = {
      items: [
        { overdue: true, valueTodayCents: 1000 },
        { overdue: false, valueTodayCents: 500 },
        { overdue: true, valueTodayCents: 250 },
      ],
    } as FinanceSummary['owed'];
    expect(overdueOwed(owed)).toEqual({ count: 2, totalCents: 1250 });
  });
});
