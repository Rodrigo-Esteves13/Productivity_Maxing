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
import type {
  CourseRiskOverview,
  CourseRiskOverviewRow,
  CourseRiskSummary,
} from './course-risk-overview.types';
import {
  confidenceFor,
  failChancePct,
  passChancePct,
} from './course-risk-pass-chance.util';
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

interface AreaInfo {
  id: string;
  name: string;
  colorHex: string;
}

/** Resultado do motor para uma cadeira+periodo (risk null = motor sem veredicto). */
interface GroupRisk {
  area: AreaInfo;
  risk: CourseRisk | null;
}

/** assessed por score desc, depois not_enough_data; empates por nome (ordem estavel). */
function compareOverviewRows(
  a: CourseRiskOverviewRow,
  b: CourseRiskOverviewRow,
): number {
  if (a.status !== b.status) return a.status === 'assessed' ? -1 : 1;
  if (a.risk && b.risk && a.risk.score !== b.risk.score) {
    return b.risk.score - a.risk.score;
  }
  return a.areaName.localeCompare(b.areaName);
}

/** Media ponderada pelo peso avaliado; media simples se todos os pesos forem 0. */
function weightedAvgPassChance(
  rows: readonly { passChancePct: number; gradedWeightPct: number }[],
): number | null {
  if (rows.length === 0) return null;
  const totalWeight = rows.reduce((sum, r) => sum + r.gradedWeightPct, 0);
  if (totalWeight <= 0) {
    return Math.round(
      rows.reduce((sum, r) => sum + r.passChancePct, 0) / rows.length,
    );
  }
  return Math.round(
    rows.reduce((sum, r) => sum + r.passChancePct * r.gradedWeightPct, 0) /
      totalWeight,
  );
}

function buildSummary(courses: CourseRiskOverviewRow[]): CourseRiskSummary {
  const assessed = courses.filter(
    (
      c,
    ): c is CourseRiskOverviewRow & {
      risk: CourseRisk;
      passChancePct: number;
    } => c.risk != null && c.passChancePct != null,
  );
  const count = (levels: readonly CourseRisk['level'][]) =>
    assessed.filter((c) => levels.includes(c.risk.level)).length;

  let worst: (typeof assessed)[number] | null = null;
  for (const c of assessed) {
    if (
      !worst ||
      c.passChancePct < worst.passChancePct ||
      (c.passChancePct === worst.passChancePct &&
        (c.risk.score > worst.risk.score ||
          (c.risk.score === worst.risk.score &&
            c.areaName.localeCompare(worst.areaName) < 0)))
    ) {
      worst = c;
    }
  }

  return {
    totalCourses: courses.length,
    assessedCourses: assessed.length,
    highRiskCourses: count(['high', 'extreme']),
    mediumRiskCourses: count(['medium']),
    lowRiskCourses: count(['low']),
    avgPassChancePct: weightedAvgPassChance(assessed),
    worst: worst
      ? {
          areaId: worst.areaId,
          areaName: worst.areaName,
          passChancePct: worst.passChancePct,
        }
      : null,
    minGradedWeightPct: MIN_GRADED_WEIGHT_PCT,
  };
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
    const entries = await this.computeGroupRisks(
      userId,
      absenceLimitPct,
      periodId,
      false,
    );

    const worstByArea = new Map<string, CourseRisk>();
    for (const { risk } of entries) {
      if (!risk || hasTooLittleEvidence(risk)) continue;
      const current = worstByArea.get(risk.areaId);
      if (!current || risk.score > current.score) {
        worstByArea.set(risk.areaId, risk);
      }
    }
    return [...worstByArea.values()].sort((a, b) => b.score - a.score);
  }

  /**
   * Resumo de risco: TODAS as cadeiras com pelo menos uma task ou componente
   * no ambito, tambem as sem dados suficientes (status not_enough_data).
   * Mesma regra de periodos e de posse que list().
   */
  async overview(
    userId: string,
    absenceLimitPct: number = COURSE_RISK_DEFAULT_ABSENCE_LIMIT_PCT,
    periodId?: string,
  ): Promise<CourseRiskOverview> {
    if (periodId) await this.assertPeriodOwned(userId, periodId);
    const entries = await this.computeGroupRisks(
      userId,
      absenceLimitPct,
      periodId,
      true,
    );

    // Por cadeira: a linha avaliada mais arriscada; sem nenhuma, uma so linha
    // not_enough_data (com o maior peso avaliado visto).
    const byArea = new Map<string, CourseRiskOverviewRow>();
    for (const { area, risk } of entries) {
      const assessed = risk != null && !hasTooLittleEvidence(risk);
      const row: CourseRiskOverviewRow = assessed
        ? this.assessedRow(area, risk)
        : {
            areaId: area.id,
            areaName: area.name,
            colorHex: area.colorHex,
            status: 'not_enough_data',
            risk: null,
            passChancePct: null,
            failChancePct: null,
            confidence: null,
            gradedWeightPct: risk?.gradedWeightPct ?? 0,
          };
      const current = byArea.get(area.id);
      if (!current || this.isBetterRow(row, current)) byArea.set(area.id, row);
    }

    const courses = [...byArea.values()].sort(compareOverviewRows);
    return { courses, summary: buildSummary(courses) };
  }

  private assessedRow(area: AreaInfo, risk: CourseRisk): CourseRiskOverviewRow {
    const pass = passChancePct(risk);
    return {
      areaId: area.id,
      areaName: area.name,
      colorHex: area.colorHex,
      status: 'assessed',
      risk,
      passChancePct: pass,
      failChancePct: failChancePct(pass),
      confidence: confidenceFor(risk.gradedWeightPct),
      gradedWeightPct: risk.gradedWeightPct,
    };
  }

  /** assessed vence not_enough_data; entre assessed, maior score; senao maior peso avaliado. */
  private isBetterRow(
    candidate: CourseRiskOverviewRow,
    current: CourseRiskOverviewRow,
  ): boolean {
    if (candidate.status !== current.status) {
      return candidate.status === 'assessed';
    }
    if (candidate.risk && current.risk) {
      return candidate.risk.score > current.risk.score;
    }
    return candidate.gradedWeightPct > current.gradedWeightPct;
  }

  /**
   * Risco calculado por cadeira+periodo, ANTES do filtro de evidencia.
   * includeEmpty: inclui grupos sem nada avaliavel (so para o overview).
   */
  private async computeGroupRisks(
    userId: string,
    absenceLimitPct: number,
    periodId: string | undefined,
    includeEmpty: boolean,
  ): Promise<GroupRisk[]> {
    const groups = await this.loadGroups(userId, periodId, includeEmpty);
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

    const computed = await Promise.all(
      groups.map(async (group): Promise<GroupRisk | null> => {
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
        return { area, risk: computeCourseRisk(input) };
      }),
    );
    return computed.filter((entry): entry is GroupRisk => entry !== null);
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
    includeEmpty = false,
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

    // list(): so cadeiras com algo avaliavel (tasks com nota/peso ou
    // componentes). overview(): todas as que tem alguma task ou componente.
    if (includeEmpty) return [...groups.values()];
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
