import type { FinanceOccurrence } from '../api/financeService';
import type { SortDirection } from './sortDirection';

// Ordenacao da lista de movimentos do mes. Puro, sem estado.

export const FINANCE_SORT_FIELDS = ['date', 'amount', 'category'] as const;
export type FinanceSortField = (typeof FINANCE_SORT_FIELDS)[number];

export interface FinanceEntrySort {
  field: FinanceSortField;
  direction: SortDirection;
}

export const DEFAULT_FINANCE_SORT: FinanceEntrySort = { field: 'date', direction: 'desc' };

/** Copia ordenada. Empates ficam pela data, a mais recente primeiro. */
export function sortOccurrences(
  occurrences: readonly FinanceOccurrence[],
  { field, direction }: FinanceEntrySort,
  categoryLabel: (category: string) => string,
  locale: string,
): FinanceOccurrence[] {
  const sign = direction === 'asc' ? 1 : -1;
  const compare: Record<FinanceSortField, (a: FinanceOccurrence, b: FinanceOccurrence) => number> = {
    date: (a, b) => a.date.localeCompare(b.date),
    amount: (a, b) => a.amountCents - b.amountCents,
    category: (a, b) => categoryLabel(a.category).localeCompare(categoryLabel(b.category), locale),
  };
  return [...occurrences].sort((a, b) => sign * compare[field](a, b) || b.date.localeCompare(a.date));
}
