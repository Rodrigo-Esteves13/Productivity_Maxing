import type { FinanceOccurrence } from '../api/financeService';
import { matchesQuery } from './listFilter';

// Filtro da lista de movimentos do mes: texto livre, categoria e conta.
// Puro, sem estado (a UI guarda os valores).

/** Valor do filtro que nao restringe nada. */
export const FINANCE_FILTER_ALL = '';

export interface FinanceEntryFilter {
  query: string;
  category: string;
  accountId: string;
}

export const EMPTY_FINANCE_ENTRY_FILTER: FinanceEntryFilter = {
  query: '',
  category: FINANCE_FILTER_ALL,
  accountId: FINANCE_FILTER_ALL,
};

/** true quando algum criterio esta ativo. */
export function isFilteringEntries(filter: FinanceEntryFilter): boolean {
  return filter.query.trim() !== '' || filter.category !== FINANCE_FILTER_ALL || filter.accountId !== FINANCE_FILTER_ALL;
}

/**
 * Filtra as ocorrencias. `categoryLabel` e `accountName` dao o texto que a
 * pessoa ve (traduzido), para a pesquisa o encontrar.
 */
export function filterOccurrences(
  occurrences: readonly FinanceOccurrence[],
  filter: FinanceEntryFilter,
  categoryLabel: (category: string) => string,
  accountName: (accountId: string | null) => string | undefined,
): FinanceOccurrence[] {
  return occurrences.filter((occ) => {
    if (filter.category !== FINANCE_FILTER_ALL && occ.category !== filter.category) return false;
    if (filter.accountId !== FINANCE_FILTER_ALL && occ.accountId !== filter.accountId) return false;
    return matchesQuery(filter.query, [categoryLabel(occ.category), occ.note, accountName(occ.accountId)]);
  });
}

/** Categorias distintas das ocorrencias, pela ordem em que aparecem. */
export function distinctCategories(occurrences: readonly FinanceOccurrence[]): string[] {
  return [...new Set(occurrences.map((occ) => occ.category))];
}
