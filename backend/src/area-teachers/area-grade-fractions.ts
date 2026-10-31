import type { PrismaService } from '../prisma/prisma.service';
import {
  computeWeightedAverage,
  GRADED_TASK_SELECT,
  parseGradeScale,
  type AreaGradedTaskLike,
} from '../academic-programs/grade-average.util';
import { loadComponentGradedItems } from '../grade-components/grade-component-items';

export interface AreaGradeAverage {
  /** Media ponderada da cadeira normalizada 0-1. */
  average: number;
  /** Quantos itens avaliados (tasks + componentes) entraram na media. */
  count: number;
}

/**
 * Media final por cadeira do user (tasks avaliadas + componentes de nota),
 * normalizada para 0-1 pela escala do programa de cada periodo, para poder
 * misturar programas com escalas diferentes. Com periodIds, so conta o que
 * pertence a esses periodos. Cadeiras sem nota ficam de fora.
 * Partilhado por AreaTeachersService (N45) e AreaRatingsStatsService (N48).
 */
export async function loadAreaGradeFractions(
  prisma: PrismaService,
  userId: string,
  periodIds?: string[],
): Promise<Map<string, AreaGradeAverage>> {
  const periodWhere = periodIds ? { periodId: { in: periodIds } } : {};
  const [tasks, componentItems, periods] = await Promise.all([
    prisma.task.findMany({
      where: { userId, realGrade: { not: null }, ...periodWhere },
      select: GRADED_TASK_SELECT,
    }),
    loadComponentGradedItems(prisma, { userId, ...periodWhere }),
    prisma.academicPeriod.findMany({
      where: {
        program: { userId },
        ...(periodIds ? { id: { in: periodIds } } : {}),
      },
      select: { id: true, program: { select: { gradeScale: true } } },
    }),
  ]);

  const scaleByPeriod = new Map(
    periods.map((p) => [p.id, parseGradeScale(p.program.gradeScale)]),
  );
  const fallbackScale = parseGradeScale('');
  const normalised: AreaGradedTaskLike[] = [...tasks, ...componentItems]
    .filter((item): item is typeof item & { areaId: string } => !!item.areaId)
    .map((item) => {
      const scale =
        (item.periodId && scaleByPeriod.get(item.periodId)) || fallbackScale;
      return {
        ...item,
        realGrade:
          ((item.realGrade as number) - scale.min) / (scale.max - scale.min),
      };
    });

  const itemsByArea = new Map<string, AreaGradedTaskLike[]>();
  for (const item of normalised) {
    const bucket = itemsByArea.get(item.areaId) ?? [];
    bucket.push(item);
    itemsByArea.set(item.areaId, bucket);
  }
  const averages = new Map<string, AreaGradeAverage>();
  for (const [areaId, items] of itemsByArea) {
    const { average, gradedTaskCount } = computeWeightedAverage(items);
    if (average !== null) {
      averages.set(areaId, { average, count: gradedTaskCount });
    }
  }
  return averages;
}
