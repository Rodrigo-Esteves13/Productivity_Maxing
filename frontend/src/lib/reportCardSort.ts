// Ordenacao por coluna da tabela do boletim.
import type { CreditsAreaSummary } from '../types/models';
import type { SortDirection } from './sortDirection';

export type ReportCardSortKey = 'course' | 'credits' | 'grade' | 'result';

// null = sem valor (fica sempre no fim, em qualquer direcao).
const SORT_VALUE: Record<ReportCardSortKey, (row: CreditsAreaSummary) => string | number | null> = {
  course: (row) => row.areaName,
  credits: (row) => row.credits,
  grade: (row) => row.average,
  result: (row) => Number(row.passed),
};

export function sortReportCardRows(
  rows: readonly CreditsAreaSummary[],
  sort: { key: ReportCardSortKey; direction: SortDirection } | null,
  locale: string,
): CreditsAreaSummary[] {
  if (!sort) return [...rows];
  const read = SORT_VALUE[sort.key];
  const sign = sort.direction === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const left = read(a);
    const right = read(b);
    if (left === null || right === null) return Number(left === null) - Number(right === null);
    if (typeof left === 'number' && typeof right === 'number') return sign * (left - right);
    return sign * String(left).localeCompare(String(right), locale, { numeric: true, sensitivity: 'base' });
  });
}
