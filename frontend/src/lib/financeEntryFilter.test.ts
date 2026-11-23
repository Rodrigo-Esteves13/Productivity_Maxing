import { describe, expect, it } from 'vitest';
import type { FinanceOccurrence } from '../api/financeService';
import { distinctCategories, EMPTY_FINANCE_ENTRY_FILTER, filterOccurrences, isFilteringEntries } from './financeEntryFilter';

const occ = (over: Partial<FinanceOccurrence>): FinanceOccurrence => ({
  entryId: 'e',
  date: '2026-11-01',
  kind: 'EXPENSE',
  amountCents: 100,
  category: 'FOOD',
  note: null,
  accountId: null,
  frequency: null,
  projected: false,
  reason: 'REGULAR',
  ...over,
});

const label = (c: string) => c.toLowerCase();
const account = (id: string | null) => (id === 'a1' ? 'Revolut' : undefined);
const list = [
  occ({ entryId: '1', category: 'FOOD', note: 'Pizza', accountId: 'a1' }),
  occ({ entryId: '2', category: 'RENT', note: null }),
  occ({ entryId: '3', category: 'FOOD', note: 'Cafe' }),
];

describe('filterOccurrences', () => {
  it('returns everything for the empty filter', () => {
    expect(filterOccurrences(list, EMPTY_FINANCE_ENTRY_FILTER, label, account)).toHaveLength(3);
  });

  it('filters by category and account', () => {
    expect(filterOccurrences(list, { ...EMPTY_FINANCE_ENTRY_FILTER, category: 'FOOD' }, label, account)).toHaveLength(2);
    expect(filterOccurrences(list, { ...EMPTY_FINANCE_ENTRY_FILTER, accountId: 'a1' }, label, account).map((o) => o.entryId)).toEqual(['1']);
  });

  it('searches note, category label and account name', () => {
    expect(filterOccurrences(list, { ...EMPTY_FINANCE_ENTRY_FILTER, query: 'pizza' }, label, account)).toHaveLength(1);
    expect(filterOccurrences(list, { ...EMPTY_FINANCE_ENTRY_FILTER, query: 'rent' }, label, account)).toHaveLength(1);
    expect(filterOccurrences(list, { ...EMPTY_FINANCE_ENTRY_FILTER, query: 'revolut' }, label, account)).toHaveLength(1);
  });
});

describe('helpers', () => {
  it('detects an active filter', () => {
    expect(isFilteringEntries(EMPTY_FINANCE_ENTRY_FILTER)).toBe(false);
    expect(isFilteringEntries({ ...EMPTY_FINANCE_ENTRY_FILTER, query: ' x ' })).toBe(true);
    expect(isFilteringEntries({ ...EMPTY_FINANCE_ENTRY_FILTER, category: 'FOOD' })).toBe(true);
  });

  it('lists distinct categories in order', () => {
    expect(distinctCategories(list)).toEqual(['FOOD', 'RENT']);
  });
});
