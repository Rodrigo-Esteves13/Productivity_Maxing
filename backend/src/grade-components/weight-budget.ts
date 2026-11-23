import { roundTo } from '../common/round.util';
import { BadRequestException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

// Cliente normal ou de transacao (tasks.service valida o peso dentro da
// transacao com o lock do user, B-42).
type WeightDb = Pick<Prisma.TransactionClient, 'task' | 'gradeComponent'>;

// Uma cadeira (Area) num periodo vale 100% da nota final. Tasks avaliadas
// e componentes de nota (exame, seminarios, participacao...) partilham
// esse orcamento: a soma dos pesos nunca pode passar disto.
export const MAX_COURSE_WEIGHT_PERCENT = 100;

// Margem para erros de virgula flutuante (33.3 + 33.3 + 33.4).
export const WEIGHT_EPSILON = 0.001;

export interface WeightScope {
  userId: string;
  areaId: string;
  periodId: string | null;
  // Fora da soma: a task/componente que esta a ser editada.
  excludeTaskId?: string;
  // Tasks que vao ser apagadas a seguir (import de pacote em modo substituir).
  excludeTaskIds?: string[];
  excludeComponentId?: string;
}

function excludedTaskFilter(scope: WeightScope) {
  const ids = [
    ...(scope.excludeTaskId ? [scope.excludeTaskId] : []),
    ...(scope.excludeTaskIds ?? []),
  ];
  return ids.length > 0 ? { id: { notIn: ids } } : {};
}

/** Peso ja atribuido na cadeira+periodo (tasks com peso + componentes). */
export async function loadUsedWeight(
  prisma: WeightDb,
  scope: WeightScope,
): Promise<number> {
  const [tasks, components] = await Promise.all([
    prisma.task.findMany({
      where: {
        userId: scope.userId,
        areaId: scope.areaId,
        periodId: scope.periodId,
        weightPercentage: { not: null },
        ...excludedTaskFilter(scope),
      },
      select: {
        title: true,
        weightPercentage: true,
        recurrenceFrequency: true,
      },
    }),
    prisma.gradeComponent.aggregate({
      _sum: { weightPercentage: true },
      where: {
        userId: scope.userId,
        areaId: scope.areaId,
        ...(scope.periodId ? { periodId: scope.periodId } : {}),
        ...(scope.excludeComponentId
          ? { id: { not: scope.excludeComponentId } }
          : {}),
      },
    }),
  ]);

  // Uma serie recorrente (mesmo titulo) vale o peso UMA vez: cada
  // ocorrencia nova copia o peso da anterior, somar todas passaria
  // sempre dos 100%.
  let taskTotal = 0;
  const seriesWeight = new Map<string, number>();
  for (const task of tasks) {
    const weight = task.weightPercentage ?? 0;
    if (task.recurrenceFrequency) {
      seriesWeight.set(
        task.title,
        Math.max(seriesWeight.get(task.title) ?? 0, weight),
      );
    } else {
      taskTotal += weight;
    }
  }
  for (const weight of seriesWeight.values()) taskTotal += weight;

  return taskTotal + (components._sum.weightPercentage ?? 0);
}

export interface AreaWeightScope {
  userId: string;
  periodId: string | null;
  // Sem areaIds: todas as cadeiras com algum peso no periodo.
  areaIds?: string[];
}

/**
 * Peso ja atribuido por cadeira num periodo, em 3 groupBy em vez de
 * loadUsedWeight por cadeira (B-36). Mesmas regras de loadUsedWeight: uma
 * serie recorrente (mesmo titulo) conta o peso maior UMA vez, e os
 * componentes so filtram por periodo quando ha periodo.
 */
export async function loadUsedWeightByArea(
  prisma: WeightDb,
  scope: AreaWeightScope,
): Promise<Map<string, number>> {
  const areaFilter = scope.areaIds ? { areaId: { in: scope.areaIds } } : {};
  const taskWhere = {
    userId: scope.userId,
    periodId: scope.periodId,
    weightPercentage: { not: null },
    ...areaFilter,
  };
  const [singleTasks, seriesTasks, components] = await Promise.all([
    prisma.task.groupBy({
      by: ['areaId'],
      where: { ...taskWhere, recurrenceFrequency: null },
      _sum: { weightPercentage: true },
    }),
    prisma.task.groupBy({
      by: ['areaId', 'title'],
      where: { ...taskWhere, recurrenceFrequency: { not: null } },
      _max: { weightPercentage: true },
    }),
    prisma.gradeComponent.groupBy({
      by: ['areaId'],
      where: {
        userId: scope.userId,
        ...(scope.periodId ? { periodId: scope.periodId } : {}),
        ...areaFilter,
      },
      _sum: { weightPercentage: true },
    }),
  ]);

  const used = new Map<string, number>();
  const add = (areaId: string, weight: number | null) =>
    used.set(areaId, (used.get(areaId) ?? 0) + (weight ?? 0));
  for (const row of singleTasks) add(row.areaId, row._sum.weightPercentage);
  for (const row of seriesTasks) add(row.areaId, row._max.weightPercentage);
  for (const row of components) add(row.areaId, row._sum.weightPercentage);
  return used;
}

/** Lanca 400 se `weight` fizer a cadeira passar dos 100%. */
export async function assertWeightFits(
  prisma: WeightDb,
  scope: WeightScope,
  weight: number | null | undefined,
): Promise<void> {
  if (!weight || weight <= 0) return;
  const used = await loadUsedWeight(prisma, scope);
  const remaining = Math.max(0, MAX_COURSE_WEIGHT_PERCENT - used);
  if (weight > remaining + WEIGHT_EPSILON) {
    throw new BadRequestException(
      `This course already has ${roundTo(used)}% of the final grade assigned. Only ${roundTo(remaining)}% is left.`,
    );
  }
}
