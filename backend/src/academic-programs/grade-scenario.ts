import type { Prisma } from '@prisma/client';
import { IsIn, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import type { PrismaService } from '../prisma/prisma.service';
import { GRADED_TASK_SELECT, type GradedTaskLike } from './grade-average.util';
import { computeComponentGrade } from '../grade-components/grade-component.util';
import { loadComponentGradedItems } from '../grade-components/grade-component-items';
import type { GradeAggregationKind } from '../grade-components/grade-components.constants';
import { median } from '../study-plan/plan-scenario.util';

// Cenario das medias: 'real' (so notas lancadas, o de sempre) ou 'plan'
// ("se tudo correr como planeado": o modo plano do Dashboard). As regras do
// plano sao as do cartao "If all goes according to plan" (ver
// study-plan/plan-scenario.util.ts):
// - avaliacao com peso e sem nota: conta a nota-alvo; sem alvo, a mediana
//   das tuas notas nessa cadeira (no periodo); sem nenhuma, a do periodo;
// - componentes (participacao, presencas...): as entradas que faltam valem
//   essa mesma mediana;
// - periodos arquivados nunca sao "preenchidos" (ja acabaram).
export const GRADE_SCENARIOS = ['real', 'plan'] as const;
export type GradeScenario = (typeof GRADE_SCENARIOS)[number];

export class GradeScenarioQueryDto {
  @ApiPropertyOptional({
    enum: GRADE_SCENARIOS,
    description:
      '"plan" fills every graded item without a grade with its target grade (or the median of your grades), as if everything went according to plan.',
  })
  @IsOptional()
  @IsIn(GRADE_SCENARIOS)
  scenario?: GradeScenario;
}

export interface PlanTaskRow {
  areaId: string;
  periodId: string | null;
  title: string;
  recurrenceFrequency: string | null;
  realGrade: number | null;
  weightPercentage: number | null;
  targetGrade: number | null;
  isArchivedPeriod: boolean;
}

export interface PlanComponentRow {
  areaId: string;
  periodId: string;
  weightPercentage: number;
  aggregation: GradeAggregationKind;
  bestOfCount: number | null;
  expectedEntries: number | null;
  grades: number[];
  isArchivedPeriod: boolean;
}

type AreaGradedItem = GradedTaskLike & { areaId: string };

const areaKey = (areaId: string, periodId: string | null) =>
  `${areaId}|${periodId ?? ''}`;

/** Logica pura do cenario 'plan' (sem BD), testavel a parte. */
export function applyPlanScenario(
  tasks: PlanTaskRow[],
  components: PlanComponentRow[],
): AreaGradedItem[] {
  const byArea = new Map<string, number[]>();
  const byPeriod = new Map<string, number[]>();
  const remember = (areaId: string, periodId: string | null, grade: number) => {
    const a = areaKey(areaId, periodId);
    byArea.set(a, [...(byArea.get(a) ?? []), grade]);
    const p = periodId ?? '';
    byPeriod.set(p, [...(byPeriod.get(p) ?? []), grade]);
  };
  for (const t of tasks) {
    if (t.realGrade !== null) remember(t.areaId, t.periodId, t.realGrade);
  }
  for (const c of components) {
    for (const g of c.grades) remember(c.areaId, c.periodId, g);
  }
  const fillFor = (areaId: string, periodId: string | null) =>
    median(byArea.get(areaKey(areaId, periodId)) ?? []) ??
    median(byPeriod.get(periodId ?? '') ?? []);

  const items: AreaGradedItem[] = [];
  for (const t of tasks) {
    const base = {
      areaId: t.areaId,
      periodId: t.periodId,
      title: t.title,
      recurrenceFrequency: t.recurrenceFrequency,
      weightPercentage: t.weightPercentage,
    };
    if (t.realGrade !== null) {
      items.push({ ...base, realGrade: t.realGrade });
      continue;
    }
    if (t.isArchivedPeriod || (t.weightPercentage ?? 0) <= 0) continue;
    const planned = t.targetGrade ?? fillFor(t.areaId, t.periodId);
    if (planned !== null) items.push({ ...base, realGrade: planned });
  }

  for (const c of components) {
    const missing = c.isArchivedPeriod
      ? 0
      : c.grades.length === 0
        ? Math.max(1, c.expectedEntries ?? 1)
        : Math.max(0, (c.expectedEntries ?? 0) - c.grades.length);
    const fill = missing > 0 ? fillFor(c.areaId, c.periodId) : null;
    const grades =
      fill !== null
        ? [...c.grades, ...Array<number>(missing).fill(fill)]
        : c.grades;
    const grade = computeComponentGrade(grades, c.aggregation, c.bestOfCount);
    if (grade === null) continue;
    items.push({
      areaId: c.areaId,
      periodId: c.periodId,
      realGrade: grade,
      weightPercentage: c.weightPercentage,
    });
  }
  return items;
}

/**
 * Itens avaliados (tasks + componentes) para as contas de media, no cenario
 * pedido. Os `where` vem ja restritos a um periodo/programa do proprio user
 * (o chamador valida a posse antes).
 */
export async function loadScenarioGradedItems(
  prisma: PrismaService,
  taskWhere: Prisma.TaskWhereInput,
  componentWhere: Prisma.GradeComponentWhereInput,
  scenario: GradeScenario = 'real',
): Promise<AreaGradedItem[]> {
  if (scenario === 'real') {
    const [tasks, componentItems] = await Promise.all([
      prisma.task.findMany({
        where: { ...taskWhere, realGrade: { not: null } },
        select: GRADED_TASK_SELECT,
      }),
      loadComponentGradedItems(prisma, componentWhere),
    ]);
    return [...tasks, ...componentItems];
  }

  const [tasks, components] = await Promise.all([
    prisma.task.findMany({
      where: taskWhere,
      select: {
        ...GRADED_TASK_SELECT,
        targetGrade: true,
        period: { select: { isArchived: true } },
      },
    }),
    prisma.gradeComponent.findMany({
      where: componentWhere,
      select: {
        areaId: true,
        periodId: true,
        weightPercentage: true,
        aggregation: true,
        bestOfCount: true,
        expectedEntries: true,
        entries: { select: { grade: true } },
        period: { select: { isArchived: true } },
      },
    }),
  ]);
  return applyPlanScenario(
    tasks.map((t) => ({
      areaId: t.areaId,
      periodId: t.periodId,
      title: t.title,
      recurrenceFrequency: t.recurrenceFrequency,
      realGrade: t.realGrade,
      weightPercentage: t.weightPercentage,
      targetGrade: t.targetGrade,
      isArchivedPeriod: t.period?.isArchived ?? false,
    })),
    components.map((c) => ({
      areaId: c.areaId,
      periodId: c.periodId,
      weightPercentage: c.weightPercentage,
      aggregation: c.aggregation,
      bestOfCount: c.bestOfCount,
      expectedEntries: c.expectedEntries,
      grades: c.entries.map((e) => e.grade),
      isArchivedPeriod: c.period.isArchived,
    })),
  );
}
