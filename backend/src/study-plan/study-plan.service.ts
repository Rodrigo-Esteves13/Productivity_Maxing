import { Injectable } from '@nestjs/common';
import { Difficulty, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ScheduleService } from '../schedule/schedule.service';
import {
  StudySessionsService,
  HOUR_BUCKET_SIZE,
} from '../study-sessions/study-sessions.service';
import { WorkShiftsService } from '../work-shifts/work-shifts.service';
import { PredictionService } from '../prediction/prediction.service';
import { DIFFICULTY_WEIGHT } from '../common/difficulty-weight.util';
import {
  hasStudyTimeWhere,
  resolveFocusedStudyMinutes,
  sumFocusedSessionMinutes,
} from '../common/session-minutes.util';
import type { PredictionMethod } from '../prediction/prediction.types';
import { addUtcDays, getLisbonNow, toDateKey } from '../common/date-key.util';
import {
  DEFAULT_DAILY_STUDY_LIMIT_MINUTES,
  MINUTES_PER_DAY,
  MIN_BLOCK_MINUTES,
  MIN_HISTORY_SAMPLES,
  OVERTIME_EXTRA_MINUTES_PER_DAY,
} from './study-plan.constants';
import {
  buildFreeSlots,
  clamp,
  planStudyBlocks,
  sumSlots,
  type Interval,
  type SchedulerDay,
  type SchedulerTask,
} from './study-plan.scheduler';
import {
  computeNeededMinutes,
  resolveEstimate,
  type ResolvedEstimate,
} from './study-plan.estimates';
import { resolveCapacityStatus } from './study-plan.summary';
import { UpdateStudyPlanSettingsDto } from './dto/update-study-plan-settings.dto';
import type {
  CourseForecast,
  StudyPlanDay,
  StudyPlanResult,
  StudyPlanTask,
} from './study-plan.types';

export interface EstimableTask {
  id: string;
  taskTypeId: string;
  areaId: string;
  difficulty: Difficulty;
  weightPercentage: number | null;
  estimatedMinutes: number | null;
  studySessions: {
    startedAt: Date;
    endedAt: Date | null;
    focusRating: number | null;
  }[];
}

// Campos que qualquer consulta de tasks para estimativa tem de selecionar.
export const ESTIMABLE_TASK_SELECT = {
  id: true,
  title: true,
  difficulty: true,
  weightPercentage: true,
  estimatedMinutes: true,
  taskTypeId: true,
  areaId: true,
  studySessions: {
    where: { endedAt: { not: null } },
    select: { startedAt: true, endedAt: true, focusRating: true },
  },
} satisfies Prisma.TaskSelect;

interface HistoryBucket {
  sum: number;
  count: number;
}

interface CourseHistory {
  all: HistoryBucket;
  graded: HistoryBucket;
  ungraded: HistoryBucket;
  totalMinutes: number;
}

function emptyHistory(): CourseHistory {
  return {
    all: { sum: 0, count: 0 },
    graded: { sum: 0, count: 0 },
    ungraded: { sum: 0, count: 0 },
    totalMinutes: 0,
  };
}

function averageOf(bucket: HistoryBucket | undefined): number | null {
  return bucket && bucket.count > 0
    ? Math.round(bucket.sum / bucket.count)
    : null;
}

export interface ResolvedTaskEstimate {
  estimate: ResolvedEstimate;
  logged: number;
  needed: number;
}

@Injectable()
export class StudyPlanService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scheduleService: ScheduleService,
    private readonly studySessionsService: StudySessionsService,
    private readonly workShiftsService: WorkShiftsService,
    private readonly predictionService: PredictionService,
  ) {}

  async generate(userId: string, days: number): Promise<StudyPlanResult> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        commuteMinutes: true,
        quietHoursStart: true,
        quietHoursEnd: true,
        dailyStudyLimitMinutes: true,
      },
    });
    const dailyLimitMinutes =
      user.dailyStudyLimitMinutes ?? DEFAULT_DAILY_STUDY_LIMIT_MINUTES;

    const { today, nowMinutes } = getLisbonNow();
    const rangeEnd = addUtcDays(today, days - 1);

    const [classes, shifts, heatmap, tasks] = await Promise.all([
      this.scheduleService.findRange(userId, today, rangeEnd),
      this.workShiftsService.expandRange(
        userId,
        toDateKey(today),
        toDateKey(rangeEnd),
      ),
      this.studySessionsService.getHeatmap(userId),
      // Tasks pendentes com prazo dentro da janela (ou já atrasadas).
      // Períodos arquivados nunca geram sugestões; Task.periodId é
      // opcional, por isso tasks sem período também entram (um filtro
      // só por `period: { isArchived: false }` excluía-as).
      this.prisma.task.findMany({
        where: {
          userId,
          progressStatus: { not: 'COMPLETED' },
          date: { lte: rangeEnd },
          OR: [{ periodId: null }, { period: { isArchived: false } }],
        },
        select: {
          id: true,
          title: true,
          date: true,
          difficulty: true,
          weightPercentage: true,
          estimatedMinutes: true,
          taskTypeId: true,
          areaId: true,
          area: { select: { name: true, colorHex: true } },
          studySessions: {
            where: { endedAt: { not: null } },
            select: { startedAt: true, endedAt: true, focusRating: true },
          },
        },
        orderBy: { date: 'asc' },
      }),
    ]);

    const estimates = await this.resolveEstimates(userId, tasks);

    // dayOfWeek x hourBucket -> minutos, para preferir os slots livres
    // nas horas onde o utilizador historicamente estuda mais.
    const heatmapScore = new Map<string, number>();
    for (const cell of heatmap) {
      heatmapScore.set(
        `${cell.dayOfWeek}:${cell.hourBucket}`,
        cell.totalMinutes,
      );
    }

    const commuteBuffer = user.commuteMinutes ?? 0;
    const schedulerDays: SchedulerDay[] = [];
    for (let i = 0; i < days; i++) {
      const day = addUtcDays(today, i);
      const key = toDateKey(day);
      const dayClasses = classes.filter((c) => toDateKey(c.date) === key);
      const dayShifts = shifts.filter((s) => s.date === key);

      // Aulas levam o buffer de viagem do utilizador; cada turno leva o
      // seu próprio (o trajeto para o trabalho é outro).
      const busy: Interval[] = [
        ...dayClasses.map((c) => ({
          start: clamp(c.startMinutes - commuteBuffer, 0, MINUTES_PER_DAY),
          end: clamp(c.endMinutes + commuteBuffer, 0, MINUTES_PER_DAY),
        })),
        ...dayShifts.map((s) => ({
          start: clamp(s.startMinutes - s.bufferMinutes, 0, MINUTES_PER_DAY),
          end: clamp(s.endMinutes + s.bufferMinutes, 0, MINUTES_PER_DAY),
        })),
      ];

      schedulerDays.push({
        key,
        dayOfWeek: day.getUTCDay(),
        classMinutes: dayClasses.reduce(
          (sum, c) => sum + (c.endMinutes - c.startMinutes),
          0,
        ),
        workMinutes: dayShifts.reduce(
          (sum, s) => sum + (s.endMinutes - s.startMinutes),
          0,
        ),
        freeSlots: buildFreeSlots(
          busy,
          user.quietHoursStart,
          user.quietHoursEnd,
          i === 0 ? nowMinutes : 0,
        ),
      });
    }

    const resolvedByTaskId = estimates.byTaskId;

    const schedulerTasks: SchedulerTask[] = tasks.map((task) => ({
      taskId: task.id,
      deadlineKey: toDateKey(task.date),
      weightPercentage: task.weightPercentage,
      difficultyRank: DIFFICULTY_WEIGHT[task.difficulty],
      neededMinutes: resolvedByTaskId.get(task.id)?.needed ?? 0,
    }));

    const output = planStudyBlocks(
      schedulerDays,
      schedulerTasks,
      {
        dailyLimitMinutes,
        overtimeExtraMinutes: OVERTIME_EXTRA_MINUTES_PER_DAY,
        minBlockMinutes: MIN_BLOCK_MINUTES,
      },
      (dayOfWeek, slot) => this.scoreSlot(dayOfWeek, slot, heatmapScore),
    );

    const titleById = new Map(tasks.map((t) => [t.id, t.title]));
    const planTasks: StudyPlanTask[] = tasks.map((task) => {
      const resolved = resolvedByTaskId.get(task.id);
      const result = output.byTask.get(task.id);
      return {
        taskId: task.id,
        title: task.title,
        areaName: task.area.name,
        areaColorHex: task.area.colorHex,
        deadline: toDateKey(task.date),
        estimateMinutes: resolved?.estimate.minutes ?? 0,
        estimateSource: resolved?.estimate.source ?? 'default',
        loggedMinutes: resolved?.logged ?? 0,
        neededMinutes: resolved?.needed ?? 0,
        plannedMinutes: result?.plannedMinutes ?? 0,
        overtimeMinutes: result?.overtimeMinutes ?? 0,
        shortfallMinutes: result?.shortfallMinutes ?? 0,
      };
    });

    const planDays: StudyPlanDay[] = schedulerDays.map((day, index) => {
      const dayResult = output.byDay[index];
      return {
        date: day.key,
        classMinutes: day.classMinutes,
        workMinutes: day.workMinutes,
        studyMinutes: dayResult?.studyMinutes ?? 0,
        overtimeMinutes: dayResult?.overtimeMinutes ?? 0,
        freeMinutes: dayResult?.freeMinutes ?? 0,
      };
    });

    const totals = {
      neededMinutes: planTasks.reduce((s, t) => s + t.neededMinutes, 0),
      plannedMinutes: planTasks.reduce((s, t) => s + t.plannedMinutes, 0),
      overtimeMinutes: planTasks.reduce((s, t) => s + t.overtimeMinutes, 0),
      shortfallMinutes: planTasks.reduce((s, t) => s + t.shortfallMinutes, 0),
    };

    return {
      suggestions: output.blocks.map((block) => ({
        ...block,
        taskTitle: titleById.get(block.taskId) ?? '',
      })),
      tasks: planTasks.sort(
        (a, b) =>
          a.deadline.localeCompare(b.deadline) ||
          a.title.localeCompare(b.title),
      ),
      days: planDays,
      summary: {
        status: resolveCapacityStatus(totals),
        ...totals,
        availableMinutes: schedulerDays.reduce(
          (sum, day) =>
            sum + Math.min(sumSlots(day.freeSlots), dailyLimitMinutes),
          0,
        ),
        calibrationFactor: estimates.calibrationFactor,
        predictionMethod: estimates.predictionMethod,
      },
      dailyLimitMinutes,
      overtimeExtraMinutes: OVERTIME_EXTRA_MINUTES_PER_DAY,
    };
  }

  /**
   * Dados reais por cadeira: quanto já estudaste, quanto costumam pedir as
   * tasks que já concluíste (com e sem peso na nota) e quanto ainda falta
   * nas pendentes, com as mesmas estimativas do plano.
   */
  async courses(userId: string): Promise<CourseForecast[]> {
    const pending = await this.prisma.task.findMany({
      where: {
        userId,
        progressStatus: { not: 'COMPLETED' },
        OR: [{ periodId: null }, { period: { isArchived: false } }],
      },
      select: {
        ...ESTIMABLE_TASK_SELECT,
        date: true,
        area: { select: { name: true, colorHex: true } },
      },
    });
    const [history, estimates] = await Promise.all([
      this.loadCourseHistory(userId),
      this.resolveEstimates(userId, pending),
    ]);

    const byArea = new Map<string, CourseForecast>();
    const ensure = (areaId: string, name: string, colorHex: string) => {
      const existing = byArea.get(areaId);
      if (existing) return existing;
      const stats = history.get(areaId);
      const created: CourseForecast = {
        areaId,
        areaName: name,
        areaColorHex: colorHex,
        studiedMinutes: stats?.totalMinutes ?? 0,
        completedTasks: stats?.all.count ?? 0,
        avgMinutesPerCompletedTask: averageOf(stats?.all),
        avgMinutesPerGradedTask: averageOf(stats?.graded),
        pendingTasks: 0,
        remainingMinutes: 0,
        nextDeadline: null,
      };
      byArea.set(areaId, created);
      return created;
    };

    for (const task of pending) {
      const course = ensure(task.areaId, task.area.name, task.area.colorHex);
      const resolved = estimates.byTaskId.get(task.id);
      const deadline = toDateKey(task.date);
      course.pendingTasks += 1;
      course.remainingMinutes += resolved?.needed ?? 0;
      course.studiedMinutes += resolved?.logged ?? 0;
      if (!course.nextDeadline || deadline < course.nextDeadline) {
        course.nextDeadline = deadline;
      }
    }

    // Cadeiras só com tasks concluídas (nada pendente) também interessam.
    if (history.size > 0) {
      const missing = [...history.keys()].filter((id) => !byArea.has(id));
      if (missing.length > 0) {
        const areas = await this.prisma.area.findMany({
          where: { id: { in: missing } },
          select: { id: true, name: true, colorHex: true },
        });
        for (const area of areas) ensure(area.id, area.name, area.colorHex);
      }
    }

    return [...byArea.values()].sort(
      (a, b) => b.studiedMinutes - a.studiedMinutes,
    );
  }

  // Estimativa final de cada task: manual (corrigida pelo teu histórico),
  // previsão, média da cadeira ou tabela por defeito. Partilhada pelo
  // plano e pelo resumo por cadeira, para os dois nunca divergirem.
  // Publico para o GradeProjectionService usar as MESMAS estimativas do plano.
  async resolveEstimates(
    userId: string,
    tasks: EstimableTask[],
  ): Promise<{
    byTaskId: Map<string, ResolvedTaskEstimate>;
    calibrationFactor: number | null;
    predictionMethod: PredictionMethod;
  }> {
    const [calibrationFactor, prediction, history] = await Promise.all([
      this.predictionService.getCalibrationFactor(userId),
      // Previsão só para tasks sem estimativa manual: o modelo foi treinado
      // com estimatedMinutes = 0 nesses casos.
      this.predictionService.predictForTasks(
        userId,
        tasks
          .filter((t) => !t.estimatedMinutes)
          .map((t) => ({
            id: t.id,
            taskTypeId: t.taskTypeId,
            areaId: t.areaId,
            difficulty: t.difficulty,
            weightPercentage: t.weightPercentage,
          })),
      ),
      this.loadCourseHistory(userId),
    ]);

    const byTaskId = new Map<string, ResolvedTaskEstimate>(
      tasks.map((task): [string, ResolvedTaskEstimate] => {
        const isGraded = (task.weightPercentage ?? 0) > 0;
        const stats = history.get(task.areaId);
        const bucket = isGraded ? stats?.graded : stats?.ungraded;
        const estimate = resolveEstimate(
          {
            manualMinutes: task.estimatedMinutes,
            predictedMinutes: prediction.minutesByTaskId.get(task.id) ?? null,
            // Uma só tarefa feita é demasiado ruído para mandar no plano.
            courseHistoryMinutes:
              bucket && bucket.count >= MIN_HISTORY_SAMPLES
                ? averageOf(bucket)
                : null,
            difficulty: task.difficulty,
            isGraded,
          },
          calibrationFactor,
        );
        const logged = sumFocusedSessionMinutes(task.studySessions);
        return [
          task.id,
          {
            estimate,
            logged,
            needed: computeNeededMinutes(estimate.minutes, logged),
          },
        ];
      }),
    );

    return { byTaskId, calibrationFactor, predictionMethod: prediction.method };
  }

  // Tempo real gasto nas tasks CONCLUÍDAS de cada cadeira, separado em
  // com nota / sem nota (uma frequência não se compara a um exercício).
  private async loadCourseHistory(
    userId: string,
  ): Promise<Map<string, CourseHistory>> {
    const done = await this.prisma.task.findMany({
      where: {
        userId,
        progressStatus: 'COMPLETED',
        AND: [hasStudyTimeWhere()],
      },
      select: {
        areaId: true,
        weightPercentage: true,
        recalledStudyMinutes: true,
        studySessions: {
          where: { endedAt: { not: null } },
          select: { startedAt: true, endedAt: true, focusRating: true },
        },
      },
    });

    const history = new Map<string, CourseHistory>();
    for (const task of done) {
      const minutes = resolveFocusedStudyMinutes(
        task.studySessions,
        task.recalledStudyMinutes,
      );
      if (minutes <= 0) continue;

      const stats = history.get(task.areaId) ?? emptyHistory();
      const bucket =
        (task.weightPercentage ?? 0) > 0 ? stats.graded : stats.ungraded;
      for (const target of [stats.all, bucket]) {
        target.sum += minutes;
        target.count += 1;
      }
      stats.totalMinutes += minutes;
      history.set(task.areaId, stats);
    }
    return history;
  }

  async updateSettings(userId: string, dto: UpdateStudyPlanSettingsDto) {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { dailyStudyLimitMinutes: dto.dailyLimitMinutes },
      select: { dailyStudyLimitMinutes: true },
    });
    return {
      dailyLimitMinutes:
        updated.dailyStudyLimitMinutes ?? DEFAULT_DAILY_STUDY_LIMIT_MINUTES,
    };
  }

  // NOTA: StudySessionsService.getHeatmap() deriva dayOfWeek/hourBucket de
  // `session.startedAt.getDay()`/`.getHours()` (fuso do PROCESSO, UTC no
  // Render). Aqui usa-se o mesmo sistema de coordenadas para não comparar
  // dois relógios diferentes. Pré-existente e sem grande impacto: é só um
  // desempate entre slots, não um limite rígido.
  private scoreSlot(
    dayOfWeek: number,
    slot: Interval,
    heatmapScore: Map<string, number>,
  ): number {
    const midpoint = Math.floor((slot.start + slot.end) / 2);
    const bucket = Math.floor(midpoint / 60 / HOUR_BUCKET_SIZE);
    return heatmapScore.get(`${dayOfWeek}:${bucket}`) ?? 0;
  }
}
