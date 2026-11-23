import type { AcademicPeriod } from '../types/models';

// Periodos para um <select>: mais recente primeiro (data de inicio), os
// arquivados no fim. O sort e estavel, por isso empates mantem a ordem original.
export function sortPeriodsForSelect<T extends Pick<AcademicPeriod, 'startDate' | 'isArchived'>>(periods: T[]): T[] {
  return [...periods].sort((a, b) => {
    if (a.isArchived !== b.isArchived) return a.isArchived ? 1 : -1;
    return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
  });
}

// Nome com a etiqueta de arquivado (ex: "2025/26 (archived)"); `archivedTag` ja traduzido.
export function periodOptionLabel(period: Pick<AcademicPeriod, 'name' | 'isArchived'>, archivedTag: string): string {
  return period.isArchived ? `${period.name} ${archivedTag}` : period.name;
}
