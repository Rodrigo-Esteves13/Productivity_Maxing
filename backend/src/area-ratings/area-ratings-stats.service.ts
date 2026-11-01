import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { accessibleAreaWhere } from '../areas/area-access';
import { AreaTeachersService } from '../area-teachers/area-teachers.service';
import { loadAreaGradeFractions } from '../area-teachers/area-grade-fractions';
import { sumSessionMinutes } from '../common/session-minutes.util';
import { roundTo } from '../common/round.util';
import { MS_PER_DAY } from '../common/time.constants';
import type { Prisma } from '@prisma/client';
import { RATING_STATS_DECIMALS } from './area-ratings.constants';
import { buildRatingStats, mean } from './area-ratings-stats.util';
import type { RatingCourseRow, RatingStats } from './area-ratings.types';

interface PeriodScope {
  id: string;
  startDate: Date;
  endDate: Date | null;
}

interface SessionRow {
  startedAt: Date;
  endedAt: Date | null;
  focusRating: number | null;
}

@Injectable()
export class AreaRatingsStatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly teachers: AreaTeachersService,
  ) {}

  /**
   * Avaliacoes do user cruzadas com nota final, foco e tempo de estudo, por
   * cadeira. Cadeiras = as que tem tasks ou componentes de nota do user nos
   * periodos nao arquivados, ou so no periodId pedido (que tem de ser do
   * user, senao 404, mesmo arquivado). So dados do proprio user.
   */
  async stats(userId: string, periodId?: string): Promise<RatingStats> {
    const periods = await this.resolvePeriods(userId, periodId);
    const periodIds = periods.map((p) => p.id);
    const areaIds = await this.loadCourseAreaIds(userId, periodIds);
    if (areaIds.length === 0) return buildRatingStats([]);

    await this.teachers.syncFromScheduleSafe(userId);
    const [areas, ratings, teacherNotes, grades, sessionsByArea] =
      await Promise.all([
        this.prisma.area.findMany({
          where: { id: { in: areaIds }, ...accessibleAreaWhere(userId) },
          select: { id: true, name: true, colorHex: true },
        }),
        this.prisma.areaRating.findMany({
          where: { userId, areaId: { in: areaIds } },
          select: { areaId: true, teacherRating: true, courseLiking: true },
        }),
        this.prisma.areaTeacherNote.findMany({
          where: { userId, areaId: { in: areaIds } },
          select: { areaId: true, teacherName: true },
        }),
        loadAreaGradeFractions(this.prisma, userId, periodIds),
        this.loadSessionsByArea(userId, areaIds, periods),
      ]);

    const ratingByArea = new Map(ratings.map((r) => [r.areaId, r]));
    const teacherByArea = new Map(
      teacherNotes.map((n) => [n.areaId, n.teacherName.trim()]),
    );

    const rows: RatingCourseRow[] = areas.map((area) => {
      const rating = ratingByArea.get(area.id);
      const sessions = sessionsByArea.get(area.id) ?? [];
      const focus = mean(
        sessions.flatMap((s) =>
          s.focusRating === null ? [] : [s.focusRating],
        ),
      );
      return {
        areaId: area.id,
        areaName: area.name,
        colorHex: area.colorHex,
        teacherName: teacherByArea.get(area.id) ?? null,
        teacherRating: rating?.teacherRating ?? null,
        courseLiking: rating?.courseLiking ?? null,
        avgFocus: focus === null ? null : roundTo(focus, RATING_STATS_DECIMALS),
        studiedMinutes: sumSessionMinutes(sessions),
        gradeFraction: grades.get(area.id)?.average ?? null,
      };
    });
    rows.sort((a, b) => a.areaName.localeCompare(b.areaName));
    return buildRatingStats(rows);
  }

  /** AcademicPeriod nao tem userId: a posse vem do programa. */
  private async resolvePeriods(
    userId: string,
    periodId?: string,
  ): Promise<PeriodScope[]> {
    const periods = await this.prisma.academicPeriod.findMany({
      where: periodId
        ? { id: periodId, program: { userId } }
        : { isArchived: false, program: { userId } },
      select: { id: true, startDate: true, endDate: true },
    });
    if (periodId && periods.length === 0) {
      throw new NotFoundException('Period not found or no access.');
    }
    return periods;
  }

  private async loadCourseAreaIds(
    userId: string,
    periodIds: string[],
  ): Promise<string[]> {
    if (periodIds.length === 0) return [];
    const where = { userId, periodId: { in: periodIds } };
    const [tasks, components] = await Promise.all([
      this.prisma.task.findMany({
        where,
        select: { areaId: true },
        distinct: ['areaId'],
      }),
      this.prisma.gradeComponent.findMany({
        where,
        select: { areaId: true },
        distinct: ['areaId'],
      }),
    ]);
    return [...new Set([...tasks, ...components].map((row) => row.areaId))];
  }

  /**
   * Sessoes terminadas do user por cadeira, limitadas ao ambito dos periodos
   * (o mesmo que a nota). A cadeira de uma sessao e
   * `session.areaId ?? session.task.areaId` (igual a getTimeByArea).
   * - Com task: conta se a task pertence a um dos periodos.
   * - Sem task: conta por cadeira, mas so se comecou dentro das datas de um
   *   dos periodos (startDate inclusivo; endDate inclusivo ate ao fim do dia,
   *   ou sem limite superior se o periodo nao tem fim).
   */
  private async loadSessionsByArea(
    userId: string,
    areaIds: string[],
    periods: PeriodScope[],
  ): Promise<Map<string, SessionRow[]>> {
    const sessions = await this.prisma.studySession.findMany({
      where: {
        userId,
        endedAt: { not: null },
        OR: [
          {
            AND: [
              { task: { periodId: { in: periods.map((p) => p.id) } } },
              {
                OR: [
                  { areaId: { in: areaIds } },
                  { areaId: null, task: { areaId: { in: areaIds } } },
                ],
              },
            ],
          },
          {
            taskId: null,
            areaId: { in: areaIds },
            OR: periods.map(periodWindow),
          },
        ],
      },
      select: {
        startedAt: true,
        endedAt: true,
        focusRating: true,
        areaId: true,
        task: { select: { areaId: true } },
      },
    });
    const byArea = new Map<string, SessionRow[]>();
    for (const { areaId, task, ...session } of sessions) {
      const resolved = areaId ?? task?.areaId;
      if (!resolved) continue;
      const list = byArea.get(resolved) ?? [];
      list.push(session);
      byArea.set(resolved, list);
    }
    return byArea;
  }
}

/** Janela [startDate, fim do endDate) de um periodo para sessoes sem task. */
function periodWindow(period: PeriodScope): Prisma.StudySessionWhereInput {
  return {
    startedAt: {
      gte: period.startDate,
      ...(period.endDate
        ? { lt: new Date(period.endDate.getTime() + MS_PER_DAY) }
        : {}),
    },
  };
}
