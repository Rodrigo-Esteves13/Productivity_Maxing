import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  hasStudyTimeWhere,
  resolveStudyMinutes,
} from '../common/session-minutes.util';
import { toDateKey } from '../common/date-key.util';
import { parseGradeScale } from '../academic-programs/grade-average.util';
import { ESTIMABLE_TASK_SELECT, StudyPlanService } from './study-plan.service';
import {
  MIN_SAMPLES_OVERALL,
  chooseModel,
  fitGradeModel,
  fractionToGrade,
  gradeToFraction,
  marginalFractionGain,
  minutesForFraction,
  projectFraction,
} from './grade-projection.util';
import type { GradeSample, ModelOutcome } from './grade-projection.util';
import type {
  BackfillCandidate,
  GradeProjectionResult,
  GradeProjectionStatus,
  GradeProjectionTask,
} from './study-plan.types';

const DEFAULT_SCALE_TEXT = '0-20';
const ONE_HOUR = 60;
const MAX_BACKFILL_CANDIDATES = 8;
const GRADE_DECIMALS = 10;

const PERIOD_SCALE_SELECT = {
  select: { program: { select: { gradeScale: true } } },
} as const;

const round1 = (value: number) =>
  Math.round(value * GRADE_DECIMALS) / GRADE_DECIMALS;

@Injectable()
export class GradeProjectionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly studyPlanService: StudyPlanService,
  ) {}

  /**
   * Projeta a nota das tasks com peso que ainda estão por fazer, a partir
   * da relação entre tempo de estudo e nota nas que já concluíste. Só
   * projeta quando essa relação existe nos teus dados (ver
   * grade-projection.util.ts); caso contrário diz porquê.
   */
  async project(userId: string): Promise<GradeProjectionResult> {
    const [completed, pending, candidates] = await Promise.all([
      this.prisma.task.findMany({
        where: {
          userId,
          realGrade: { not: null },
          AND: [hasStudyTimeWhere()],
        },
        select: {
          areaId: true,
          realGrade: true,
          recalledStudyMinutes: true,
          period: PERIOD_SCALE_SELECT,
          studySessions: {
            where: { endedAt: { not: null } },
            select: { startedAt: true, endedAt: true },
          },
        },
      }),
      this.prisma.task.findMany({
        where: {
          userId,
          progressStatus: { not: 'COMPLETED' },
          weightPercentage: { gt: 0 },
          OR: [{ periodId: null }, { period: { isArchived: false } }],
        },
        select: {
          ...ESTIMABLE_TASK_SELECT,
          date: true,
          targetGrade: true,
          area: { select: { name: true, colorHex: true } },
          period: PERIOD_SCALE_SELECT,
        },
        orderBy: { date: 'asc' },
      }),
      this.prisma.task.findMany({
        where: {
          userId,
          realGrade: { not: null },
          NOT: hasStudyTimeWhere(),
        },
        select: {
          id: true,
          title: true,
          date: true,
          realGrade: true,
          area: { select: { name: true, colorHex: true } },
          period: PERIOD_SCALE_SELECT,
        },
        orderBy: { date: 'desc' },
        take: MAX_BACKFILL_CANDIDATES,
      }),
    ]);

    const overallSamples: GradeSample[] = [];
    const samplesByArea = new Map<string, GradeSample[]>();
    for (const task of completed) {
      if (task.realGrade === null) continue;
      const scale = parseGradeScale(
        task.period?.program.gradeScale ?? DEFAULT_SCALE_TEXT,
      );
      const sample: GradeSample = {
        minutes: resolveStudyMinutes(
          task.studySessions,
          task.recalledStudyMinutes,
        ),
        fraction: gradeToFraction(task.realGrade, scale),
      };
      overallSamples.push(sample);
      const list = samplesByArea.get(task.areaId) ?? [];
      list.push(sample);
      samplesByArea.set(task.areaId, list);
    }

    const overallOutcome = fitGradeModel(overallSamples, MIN_SAMPLES_OVERALL);
    const trainingSamples = overallSamples.length;

    const backfillCandidates = this.toBackfillCandidates(candidates);

    if (pending.length === 0) {
      return this.result(
        'nothing_pending',
        trainingSamples,
        [],
        backfillCandidates,
      );
    }

    const estimates = await this.studyPlanService.resolveEstimates(
      userId,
      pending,
    );

    const tasks = pending.map((task): GradeProjectionTask => {
      const scale = parseGradeScale(
        task.period?.program.gradeScale ?? DEFAULT_SCALE_TEXT,
      );
      const minutes = estimates.byTaskId.get(task.id)?.estimate.minutes ?? 0;
      const chosen = chooseModel(
        samplesByArea.get(task.areaId) ?? [],
        overallOutcome,
      );
      return this.buildTask(task, scale, minutes, chosen.outcome, chosen.basis);
    });

    return this.result(
      this.resolveStatus(tasks, overallOutcome),
      trainingSamples,
      tasks,
      backfillCandidates,
    );
  }

  private buildTask(
    task: {
      id: string;
      title: string;
      areaId: string;
      date: Date;
      weightPercentage: number | null;
      targetGrade: number | null;
      area: { name: string; colorHex: string };
    },
    scale: { min: number; max: number },
    minutes: number,
    outcome: ModelOutcome,
    basis: 'course' | 'overall',
  ): GradeProjectionTask {
    const base = {
      taskId: task.id,
      title: task.title,
      areaId: task.areaId,
      areaName: task.area.name,
      areaColorHex: task.area.colorHex,
      deadline: toDateKey(task.date),
      weightPercentage: task.weightPercentage ?? 0,
      minutesBasis: minutes,
      targetGrade: task.targetGrade,
      gradeMin: scale.min,
      gradeMax: scale.max,
    };

    if (outcome.kind !== 'ok') {
      return {
        ...base,
        projectedGrade: null,
        rangeGrade: null,
        gainPerExtraHour: null,
        minutesForTarget: null,
        basis: null,
        sampleSize: outcome.sampleSize,
        reason: outcome.kind,
      };
    }

    const { model } = outcome;
    const projection = projectFraction(model, minutes);
    const gain = marginalFractionGain(model, minutes, ONE_HOUR);
    const span = scale.max - scale.min;
    const targetFraction =
      task.targetGrade === null
        ? null
        : gradeToFraction(task.targetGrade, scale);
    return {
      ...base,
      projectedGrade: round1(fractionToGrade(projection.expected, scale)),
      rangeGrade: {
        low: round1(fractionToGrade(projection.low, scale)),
        high: round1(fractionToGrade(projection.high, scale)),
      },
      gainPerExtraHour: round1(gain * span),
      minutesForTarget:
        targetFraction === null
          ? null
          : minutesForFraction(model, targetFraction),
      basis,
      sampleSize: model.sampleSize,
      reason: null,
    };
  }

  private resolveStatus(
    tasks: GradeProjectionTask[],
    overall: ModelOutcome,
  ): GradeProjectionStatus {
    if (tasks.some((task) => task.projectedGrade !== null)) return 'ready';
    if (tasks.some((task) => task.reason === 'no_clear_link')) {
      return 'no_clear_link';
    }
    return overall.kind === 'no_clear_link'
      ? 'no_clear_link'
      : 'not_enough_data';
  }

  private toBackfillCandidates(
    rows: {
      id: string;
      title: string;
      date: Date;
      realGrade: number | null;
      area: { name: string; colorHex: string };
      period: { program: { gradeScale: string } } | null;
    }[],
  ): BackfillCandidate[] {
    return rows.flatMap((row) => {
      if (row.realGrade === null) return [];
      const scale = parseGradeScale(
        row.period?.program.gradeScale ?? DEFAULT_SCALE_TEXT,
      );
      return [
        {
          taskId: row.id,
          title: row.title,
          areaName: row.area.name,
          areaColorHex: row.area.colorHex,
          date: toDateKey(row.date),
          grade: row.realGrade,
          gradeMax: scale.max,
        },
      ];
    });
  }

  private result(
    status: GradeProjectionStatus,
    trainingSamples: number,
    tasks: GradeProjectionTask[],
    backfillCandidates: BackfillCandidate[],
  ): GradeProjectionResult {
    return {
      status,
      trainingSamples,
      minSamplesNeeded: MIN_SAMPLES_OVERALL,
      tasks,
      backfillCandidates,
    };
  }
}
