import { BadRequestException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';

// Uma cadeira (Area) num periodo vale 100% da nota final. Tasks avaliadas
// e componentes de nota (exame, seminarios, participacao...) partilham
// esse orcamento: a soma dos pesos nunca pode passar disto.
export const MAX_COURSE_WEIGHT_PERCENT = 100;

// Margem para erros de virgula flutuante (33.3 + 33.3 + 33.4).
const WEIGHT_EPSILON = 0.001;

export interface WeightScope {
  userId: string;
  areaId: string;
  periodId: string | null;
  // Fora da soma: a task/componente que esta a ser editada.
  excludeTaskId?: string;
  excludeComponentId?: string;
}

/** Peso ja atribuido na cadeira+periodo (tasks com peso + componentes). */
export async function loadUsedWeight(
  prisma: PrismaService,
  scope: WeightScope,
): Promise<number> {
  const [tasks, components] = await Promise.all([
    prisma.task.findMany({
      where: {
        userId: scope.userId,
        areaId: scope.areaId,
        periodId: scope.periodId,
        weightPercentage: { not: null },
        ...(scope.excludeTaskId ? { id: { not: scope.excludeTaskId } } : {}),
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

/** Lanca 400 se `weight` fizer a cadeira passar dos 100%. */
export async function assertWeightFits(
  prisma: PrismaService,
  scope: WeightScope,
  weight: number | null | undefined,
): Promise<void> {
  if (!weight || weight <= 0) return;
  const used = await loadUsedWeight(prisma, scope);
  const remaining = Math.max(0, MAX_COURSE_WEIGHT_PERCENT - used);
  if (weight > remaining + WEIGHT_EPSILON) {
    throw new BadRequestException(
      `This course already has ${round1(used)}% of the final grade assigned. Only ${round1(remaining)}% is left.`,
    );
  }
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
