import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  getPassThreshold,
  parseGradeScale,
} from '../academic-programs/grade-average.util';
import { GradeProjectionService } from './grade-projection.service';
import {
  buildCourseScenario,
  median,
  type ScenarioComponent,
  type ScenarioTask,
} from './plan-scenario.util';
import type { PlanScenarioResult } from './study-plan.types';

const DEFAULT_SCALE_TEXT = '0-20';

/**
 * Cartao "If all goes according to plan" (ver plan-scenario.util.ts para as
 * regras). So o periodo ativo: e o que o Dashboard mostra. Tudo filtrado por
 * userId; areas so as que tem avaliacoes com peso neste periodo.
 */
@Injectable()
export class PlanScenarioService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gradeProjection: GradeProjectionService,
  ) {}

  async build(userId: string): Promise<PlanScenarioResult> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        activePeriod: {
          select: {
            id: true,
            isArchived: true,
            program: { select: { gradeScale: true } },
          },
        },
      },
    });
    const period = user.activePeriod;
    const scaleText = period?.program.gradeScale ?? DEFAULT_SCALE_TEXT;
    const scale = parseGradeScale(scaleText);
    const empty: PlanScenarioResult = {
      gradeMin: scale.min,
      gradeMax: scale.max,
      passThreshold: getPassThreshold(scaleText),
      courses: [],
    };
    if (!period || period.isArchived) return empty;

    const [tasks, components, projection] = await Promise.all([
      this.prisma.task.findMany({
        where: { userId, periodId: period.id, weightPercentage: { gt: 0 } },
        select: {
          id: true,
          areaId: true,
          title: true,
          weightPercentage: true,
          realGrade: true,
          targetGrade: true,
          recurrenceFrequency: true,
          area: { select: { name: true, colorHex: true } },
        },
      }),
      this.prisma.gradeComponent.findMany({
        where: { userId, periodId: period.id },
        select: {
          areaId: true,
          name: true,
          weightPercentage: true,
          aggregation: true,
          bestOfCount: true,
          expectedEntries: true,
          entries: { select: { grade: true } },
          area: { select: { name: true, colorHex: true } },
        },
      }),
      this.gradeProjection.project(userId),
    ]);

    const projectedByTaskId = new Map(
      projection.tasks.map((t) => [t.taskId, t.projectedGrade]),
    );
    const areaInfo = new Map<string, { name: string; colorHex: string }>();
    const tasksByArea = new Map<string, ScenarioTask[]>();
    for (const task of tasks) {
      areaInfo.set(task.areaId, task.area);
      const list = tasksByArea.get(task.areaId) ?? [];
      list.push({
        areaId: task.areaId,
        title: task.title,
        weightPercentage: task.weightPercentage ?? 0,
        realGrade: task.realGrade,
        targetGrade: task.targetGrade,
        projectedGrade: projectedByTaskId.get(task.id) ?? null,
        isRecurring: task.recurrenceFrequency !== null,
      });
      tasksByArea.set(task.areaId, list);
    }
    const componentsByArea = new Map<string, ScenarioComponent[]>();
    for (const component of components) {
      areaInfo.set(component.areaId, component.area);
      const list = componentsByArea.get(component.areaId) ?? [];
      list.push({
        areaId: component.areaId,
        name: component.name,
        weightPercentage: component.weightPercentage,
        aggregation: component.aggregation,
        bestOfCount: component.bestOfCount,
        expectedEntries: component.expectedEntries,
        grades: component.entries.map((e) => e.grade),
      });
      componentsByArea.set(component.areaId, list);
    }

    const periodMedian = median([
      ...tasks.flatMap((t) => (t.realGrade !== null ? [t.realGrade] : [])),
      ...components.flatMap((c) => c.entries.map((e) => e.grade)),
    ]);

    const courses = [...areaInfo.entries()]
      .map(([areaId, area]) => ({
        ...buildCourseScenario(
          areaId,
          tasksByArea.get(areaId) ?? [],
          componentsByArea.get(areaId) ?? [],
          periodMedian,
        ),
        areaName: area.name,
        areaColorHex: area.colorHex,
      }))
      .sort((a, b) => a.areaName.localeCompare(b.areaName));

    return { ...empty, courses };
  }
}
