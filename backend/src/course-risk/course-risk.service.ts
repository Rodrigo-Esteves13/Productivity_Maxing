import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { accessibleAreaWhere } from '../areas/area-access';
import { ApprovalRulesService } from '../approval-rules/approval-rules.service';
import { computeCourseRisk } from '../approval-rules/risk-engine';
import type {
  CourseRisk,
  CourseRiskInput,
  RiskReasonCode,
} from '../approval-rules/approval-rules.types';
import { AreaTeachersService } from '../area-teachers/area-teachers.service';
import { getLisbonNow } from '../common/date-key.util';
import { summarizeAttendance } from '../schedule/attendance-summary.util';
import {
  areaAbsenceShare,
  buildRiskComponents,
  sumPostponed,
  sumStudyVsEstimate,
  type RiskComponentRow,
  type RiskTaskRow,
} from './course-risk-input.util';
import {
  COURSE_RISK_DEFAULT_ABSENCE_LIMIT_PCT,
  MAX_TASKS_SCANNED,
  MIN_GRADED_WEIGHT_PCT,
} from './course-risk.constants';

interface PeriodWindow {
  startDate: Date;
  endDate: Date | null;
}

interface CourseGroup {
  areaId: string;
  period: PeriodWindow;
  tasks: RiskTaskRow[];
  components: RiskComponentRow[];
}

// Razoes que vem das regras duras da cadeira: valem mesmo com pouco peso
// avaliado (uma nota abaixo do minimo de componente nao precisa de mais dados).
const HARD_RULE_REASONS: readonly RiskReasonCode[] = [
  'COMPONENT_BELOW_MIN',
  'TOO_MANY_BELOW_SECOND_THRESHOLD',
];

/** Peso avaliado a menos do minimo e sem regra dura violada: sem veredicto. */
export function hasTooLittleEvidence(risk: CourseRisk): boolean {
  return (
    risk.gradedWeightPct < MIN_GRADED_WEIGHT_PCT &&
    !risk.reasons.some((r) => HARD_RULE_REASONS.includes(r.code))
  );
}

const PERIOD_SELECT = { select: { startDate: true, endDate: true } } as const;

@Injectable()
export class CourseRiskService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly approvalRules: ApprovalRulesService,
    private readonly areaTeachers: AreaTeachersService,
  ) {}

  /**
   * Risco de chumbo por cadeira do user, das mais arriscadas para as menos.
   * Considera so periodos nao arquivados; cadeiras sem nenhuma nota nem
   * componente (nada para avaliar) ficam de fora, tal como as que tem menos de
   * MIN_GRADED_WEIGHT_PCT de peso avaliado sem regra dura violada. Se a mesma cadeira
   * aparece em mais de um periodo ativo, vale o periodo mais arriscado.
   * Com periodId, so conta esse periodo (que tem de ser do user, senao 404),
   * mesmo que esteja arquivado, porque foi o user que o escolheu.
   */
  async list(
    userId: string,
    absenceLimitPct: number = COURSE_RISK_DEFAULT_ABSENCE_LIMIT_PCT,
    periodId?: string,
  ): Promise<CourseRisk[]> {
    if (periodId) await this.assertPeriodOwned(userId, periodId);
    const groups = await this.loadGroups(userId, periodId);
    if (groups.length === 0) return [];

    const areaIds = [...new Set(groups.map((g) => g.areaId))];
    const [areas, teacherStats, subjectsByArea] = await Promise.all([
      this.prisma.area.findMany({
        where: { id: { in: areaIds }, ...accessibleAreaWhere(userId) },
        select: { id: true, name: true, colorHex: true },
      }),
      this.areaTeachers.teacherStatsForUser(userId),
      this.loadScheduleSubjects(userId, areaIds),
    ]);
    const now = new Date();
    const areaById = new Map(areas.map((a) => [a.id, a]));
    // Um so pedido para as regras de todas as cadeiras (so as acessiveis).
    const rulesByArea = await this.approvalRules.resolveRulesForAreas(
      userId,
      areas.map((a) => a.id),
    );

    const risks = await Promise.all(
      groups.map(async (group): Promise<CourseRisk | null> => {
        const area = areaById.get(group.areaId);
        const resolved = rulesByArea.get(group.areaId);
        if (!area || !resolved) return null;
        const absenceSharePct = await this.loadAbsenceShare(
          userId,
          subjectsByArea.get(group.areaId) ?? [],
          group.period,
        );
        const input: CourseRiskInput = {
          areaId: area.id,
          areaName: area.name,
          colorHex: area.colorHex,
          rules: resolved.rules,
          components: buildRiskComponents(group.tasks, group.components),
          ...sumStudyVsEstimate(group.tasks, now),
          absenceSharePct,
          absenceLimitPct,
          postponedCount: sumPostponed(group.tasks),
          teacher: teacherStats.get(group.areaId) ?? null,
        };
        const risk = computeCourseRisk(input);
        return risk && !hasTooLittleEvidence(risk) ? risk : null;
      }),
    );

    const worstByArea = new Map<string, CourseRisk>();
    for (const risk of risks) {
      if (!risk) continue;
      const current = worstByArea.get(risk.areaId);
      if (!current || risk.score > current.score) {
        worstByArea.set(risk.areaId, risk);
      }
    }
    return [...worstByArea.values()].sort((a, b) => b.score - a.score);
  }

  /** AcademicPeriod nao tem userId: a posse vem do programa. */
  private async assertPeriodOwned(
    userId: string,
    periodId: string,
  ): Promise<void> {
    const period = await this.prisma.academicPeriod.findFirst({
      where: { id: periodId, program: { userId } },
      select: { id: true },
    });
    if (!period) throw new NotFoundException('Period not found or no access.');
  }

  /**
   * Tasks e componentes do user, por cadeira+periodo: so o periodo pedido, ou
   * todos os nao arquivados quando nao ha periodId.
   */
  private async loadGroups(
    userId: string,
    periodId?: string,
  ): Promise<CourseGroup[]> {
    const taskPeriodWhere = periodId
      ? { periodId }
      : { periodId: { not: null }, period: { isArchived: false } };
    const componentPeriodWhere = periodId
      ? { periodId }
      : { period: { isArchived: false } };
    const [tasks, components] = await Promise.all([
      this.prisma.task.findMany({
        where: {
          userId,
          ...taskPeriodWhere,
        },
        select: {
          areaId: true,
          periodId: true,
          title: true,
          date: true,
          completedAt: true,
          weightPercentage: true,
          realGrade: true,
          recurrenceFrequency: true,
          estimatedMinutes: true,
          recalledStudyMinutes: true,
          postponedCount: true,
          period: PERIOD_SELECT,
          studySessions: {
            where: { userId, endedAt: { not: null } },
            select: { startedAt: true, endedAt: true },
          },
        },
        orderBy: { id: 'asc' },
        take: MAX_TASKS_SCANNED,
      }),
      this.prisma.gradeComponent.findMany({
        where: { userId, ...componentPeriodWhere },
        select: {
          areaId: true,
          periodId: true,
          name: true,
          weightPercentage: true,
          aggregation: true,
          bestOfCount: true,
          entries: { select: { grade: true } },
          period: PERIOD_SELECT,
        },
      }),
    ]);

    const groups = new Map<string, CourseGroup>();
    const groupFor = (
      areaId: string,
      periodId: string | null,
      period: PeriodWindow | null,
    ): CourseGroup | null => {
      if (!periodId || !period) return null;
      const key = `${areaId}|${periodId}`;
      let group = groups.get(key);
      if (!group) {
        group = { areaId, period, tasks: [], components: [] };
        groups.set(key, group);
      }
      return group;
    };

    for (const { areaId, periodId, period, ...task } of tasks) {
      groupFor(areaId, periodId, period)?.tasks.push(task);
    }
    for (const { areaId, periodId, period, ...component } of components) {
      groupFor(areaId, periodId, period)?.components.push(component);
    }

    // So cadeiras com algo avaliavel (tasks com nota/peso ou componentes).
    return [...groups.values()].filter(
      (group) =>
        group.components.length > 0 ||
        group.tasks.some(
          (t) => t.weightPercentage != null || t.realGrade != null,
        ),
    );
  }

  /** Textos de horario ligados a cada cadeira (so ligacoes do user). */
  private async loadScheduleSubjects(
    userId: string,
    areaIds: string[],
  ): Promise<Map<string, string[]>> {
    const links = await this.prisma.areaScheduleLink.findMany({
      where: { userId, areaId: { in: areaIds } },
      select: { areaId: true, scheduleSubject: true },
    });
    const byArea = new Map<string, string[]>();
    for (const link of links) {
      const list = byArea.get(link.areaId) ?? [];
      list.push(link.scheduleSubject);
      byArea.set(link.areaId, list);
    }
    return byArea;
  }

  /**
   * Faltas sobre as aulas dadas entre o inicio do periodo e hoje (ou o fim
   * do periodo, se ja passou): mesma janela do aviso semanal de faltas.
   */
  private async loadAbsenceShare(
    userId: string,
    subjects: string[],
    period: PeriodWindow,
  ): Promise<number | null> {
    if (subjects.length === 0) return null;
    const { today } = getLisbonNow();
    const to =
      period.endDate && period.endDate < today ? period.endDate : today;
    const endOfTo = new Date(to);
    endOfTo.setUTCHours(23, 59, 59, 999);

    const rows = await this.prisma.classOccurrence.groupBy({
      by: ['subject', 'attended'],
      where: {
        userId,
        subject: { in: subjects },
        date: { gte: period.startDate, lte: endOfTo },
        cancelled: false,
      },
      _count: { _all: true },
    });
    return areaAbsenceShare(summarizeAttendance(rows));
  }
}
