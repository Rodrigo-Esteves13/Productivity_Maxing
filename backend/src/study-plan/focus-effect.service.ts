import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { roundTo } from '../common/round.util';
import { MS_PER_MINUTE } from '../common/time.constants';
import {
  parseGradeScale,
  type ParsedGradeScale,
} from '../academic-programs/grade-average.util';
import { gradeToFraction } from './grade-projection.util';
import {
  MIN_FOCUS_SAMPLES,
  MIN_INTEREST_AREAS,
  MIN_INTEREST_SAMPLES,
  MIN_RATED_SHARE,
  fitFocusEffect,
  fitInterestEffect,
  type EffectOutcome,
  type FocusSample,
} from './focus-effect.util';
import {
  buildFocusTrend,
  trendWindowStart,
  type TrendSession,
  type TrendTask,
} from './focus-trend.util';
import { SCATTER_MAX_POINTS, buildFocusScatter } from './focus-scatter.util';
import { loadGradedHistory } from './graded-history.loader';
import { getLisbonNow } from '../common/date-key.util';
import type {
  FactorEffect,
  FocusEffectResult,
  FocusScatterResult,
  FocusTrendResult,
} from './study-plan.types';

const DEFAULT_SCALE_TEXT = '0-20';
// Casas decimais dos pontos de nota devolvidos (0,1 chega para a pessoa).
const GRADE_POINT_DECIMALS = 2;

@Injectable()
export class FocusEffectService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Mede se, nas tasks ja avaliadas, mais foco nas sessoes foi acompanhado
   * de melhor nota (a tempo de estudo igual). So devolve um efeito quando
   * os dados o sustentam; senao diz porque nao.
   */
  async compute(userId: string): Promise<FocusEffectResult> {
    const interestRows = await this.prisma.areaInterest.findMany({
      where: { userId },
      select: { areaId: true, rating: true },
    });
    const interestByArea = new Map(
      interestRows.map((row) => [row.areaId, row.rating]),
    );

    const history = await loadGradedHistory(this.prisma, userId);

    const samples: FocusSample[] = [];
    let excludedUnrated = 0;
    let latestScale: ParsedGradeScale | null = null;
    const gradedAreas = new Set<string>();

    for (const task of history) {
      const scale = parseGradeScale(task.gradeScale ?? DEFAULT_SCALE_TEXT);
      gradedAreas.add(task.areaId);

      let totalMinutes = 0;
      let ratedMinutes = 0;
      let ratedFocusMinutes = 0;
      for (const session of task.sessions) {
        if (!session.endedAt) continue;
        const minutes =
          (session.endedAt.getTime() - session.startedAt.getTime()) /
          MS_PER_MINUTE;
        totalMinutes += minutes;
        if (session.focusRating !== null) {
          ratedMinutes += minutes;
          ratedFocusMinutes += minutes * session.focusRating;
        }
      }
      // Sem sessoes nenhumas (so tempo lembrado, ou nada): nao ha foco para
      // medir, mas tambem nao e "faltou classificar".
      if (totalMinutes <= 0) continue;
      // Ordenadas da mais recente: a primeira com sessoes dita a escala.
      latestScale ??= scale;

      if (ratedMinutes / totalMinutes < MIN_RATED_SHARE) {
        excludedUnrated += 1;
        continue;
      }
      samples.push({
        minutes: totalMinutes,
        focus: ratedFocusMinutes / ratedMinutes,
        fraction: gradeToFraction(task.realGrade, scale),
        interest: interestByArea.get(task.areaId),
        areaId: task.areaId,
      });
    }

    const scale = latestScale ?? parseGradeScale(DEFAULT_SCALE_TEXT);
    const span = scale.max - scale.min;
    const toPoints = (fraction: number) =>
      roundTo(fraction * span, GRADE_POINT_DECIMALS);
    const toFactor = (outcome: EffectOutcome): FactorEffect => ({
      status: outcome.kind,
      sampleSize: outcome.sampleSize,
      gradePointsPerPoint:
        outcome.kind === 'clear' || outcome.kind === 'inconclusive'
          ? toPoints(outcome.effect)
          : null,
      rangeGradePoints:
        outcome.kind === 'clear'
          ? { low: toPoints(outcome.low), high: toPoints(outcome.high) }
          : null,
    });

    const areasMissingInterest = [...gradedAreas].filter(
      (areaId) => !interestByArea.has(areaId),
    ).length;

    return {
      focus: {
        ...toFactor(fitFocusEffect(samples)),
        minSamplesNeeded: MIN_FOCUS_SAMPLES,
        excludedUnrated,
      },
      interest: {
        ...toFactor(fitInterestEffect(samples)),
        minSamplesNeeded: MIN_INTEREST_SAMPLES,
        minAreasNeeded: MIN_INTEREST_AREAS,
        areasMissingInterest,
      },
      scale: { min: scale.min, max: scale.max },
    };
  }

  /** Foco medio e nota media por semana (ultimas semanas), para o grafico. */
  async trend(userId: string): Promise<FocusTrendResult> {
    const today = getLisbonNow().today;
    const from = trendWindowStart(today);

    const [sessions, tasks] = await Promise.all([
      this.prisma.studySession.findMany({
        where: { userId, endedAt: { not: null }, startedAt: { gte: from } },
        select: { startedAt: true, endedAt: true, focusRating: true },
      }),
      this.prisma.task.findMany({
        where: { userId, realGrade: { not: null }, date: { gte: from } },
        select: {
          date: true,
          realGrade: true,
          period: { select: { program: { select: { gradeScale: true } } } },
        },
      }),
    ]);

    const trendSessions: TrendSession[] = sessions.flatMap((session) =>
      session.endedAt
        ? [
            {
              startedAt: session.startedAt,
              minutes:
                (session.endedAt.getTime() - session.startedAt.getTime()) /
                MS_PER_MINUTE,
              focus: session.focusRating,
            },
          ]
        : [],
    );
    const trendTasks: TrendTask[] = tasks.flatMap((task) =>
      task.realGrade === null
        ? []
        : [
            {
              date: task.date,
              fraction: gradeToFraction(
                task.realGrade,
                parseGradeScale(
                  task.period?.program.gradeScale ?? DEFAULT_SCALE_TEXT,
                ),
              ),
            },
          ],
    );

    return { weeks: buildFocusTrend(trendSessions, trendTasks, today) };
  }

  /**
   * Uma bolinha por task avaliada: foco medio das sessoes que lhe pertencem
   * (as mesmas que o modelo usa) contra a nota.
   */
  async scatter(userId: string): Promise<FocusScatterResult> {
    const history = await loadGradedHistory(this.prisma, userId, {
      take: SCATTER_MAX_POINTS,
    });
    return {
      points: buildFocusScatter(
        history.map((task) => ({
          id: task.id,
          title: task.title,
          areaName: task.areaName,
          date: task.date,
          fraction: gradeToFraction(
            task.realGrade,
            parseGradeScale(task.gradeScale ?? DEFAULT_SCALE_TEXT),
          ),
          sessions: task.sessions.flatMap((session) =>
            session.endedAt
              ? [
                  {
                    minutes:
                      (session.endedAt.getTime() -
                        session.startedAt.getTime()) /
                      MS_PER_MINUTE,
                    focus: session.focusRating,
                  },
                ]
              : [],
          ),
        })),
      ),
    };
  }
}
