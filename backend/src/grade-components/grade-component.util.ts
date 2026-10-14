import type { GradeAggregationKind } from './grade-components.constants';

// Funcoes puras (sem BD): juntam as notas de um componente numa so nota e
// convertem componentes em "itens avaliados" para as medias da cadeira.

function mean(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Nota de um componente a partir das notas das suas entradas.
 * - AVERAGE: media de todas.
 * - BEST_OF: media das `bestOfCount` melhores (sem `bestOfCount`, todas).
 * - DROP_LOWEST: media sem a pior (com 1 so entrada, essa entrada).
 * Sem entradas -> null (nao entra nas medias: um 0 inventado puxaria a
 * media para baixo).
 */
export function computeComponentGrade(
  grades: number[],
  aggregation: GradeAggregationKind,
  bestOfCount?: number | null,
): number | null {
  const valid = grades.filter((g) => Number.isFinite(g));
  if (valid.length === 0) return null;

  const sortedDesc = [...valid].sort((a, b) => b - a);

  switch (aggregation) {
    case 'BEST_OF': {
      const count =
        bestOfCount && bestOfCount > 0
          ? Math.min(bestOfCount, sortedDesc.length)
          : sortedDesc.length;
      return round2(mean(sortedDesc.slice(0, count)));
    }
    case 'DROP_LOWEST': {
      const kept = sortedDesc.length > 1 ? sortedDesc.slice(0, -1) : sortedDesc;
      return round2(mean(kept));
    }
    case 'AVERAGE':
    default:
      return round2(mean(valid));
  }
}

export interface ComponentForAverage {
  areaId: string;
  periodId: string;
  weightPercentage: number;
  aggregation: GradeAggregationKind;
  bestOfCount: number | null;
  entries: { grade: number }[];
}

export interface ComponentGradedItem {
  areaId: string;
  periodId: string;
  realGrade: number;
  weightPercentage: number;
}

/**
 * Componentes -> itens com o mesmo formato das tasks avaliadas
 * (realGrade + weightPercentage), prontos para computeWeightedAverage.
 * Componentes sem notas ficam de fora.
 */
export function componentsToGradedItems(
  components: ComponentForAverage[],
): ComponentGradedItem[] {
  const items: ComponentGradedItem[] = [];
  for (const component of components) {
    const grade = computeComponentGrade(
      component.entries.map((e) => e.grade),
      component.aggregation,
      component.bestOfCount,
    );
    if (grade === null) continue;
    items.push({
      areaId: component.areaId,
      periodId: component.periodId,
      realGrade: grade,
      weightPercentage: component.weightPercentage,
    });
  }
  return items;
}
