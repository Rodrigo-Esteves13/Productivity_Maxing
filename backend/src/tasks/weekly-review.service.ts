import { ACTIONABLE_DEADLINE_WHERE } from '../common/task-readiness.util';
import { roundTo } from '../common/round.util';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MS_PER_MINUTE } from '../common/time.constants';

const DAY_MS = 86_400_000;
// Uma sessão esquecida aberta não pode inflacionar a semana: tecto por sessão
// (as sessões esquecidas já são fechadas sozinhas, isto é só rede de segurança).
const MAX_SESSION_MINUTES = 12 * 60;

export interface WeeklyReview {
  from: string;
  to: string;
  completed: {
    id: string;
    title: string;
    areaName: string | null;
    completedAt: string;
  }[];
  // Pendentes que foram empurradas para mais tarde alguma vez (histórico) e
  // tocadas esta semana.
  postponed: {
    id: string;
    title: string;
    areaName: string | null;
    postponedCount: number;
  }[];
  overdueCount: number;
  studyMinutes: number;
  studyByArea: { areaName: string; minutes: number }[];
  focusAverage: number | null;
  upcoming: {
    id: string;
    title: string;
    areaName: string | null;
    date: string;
  }[];
}

// Revisão dos últimos 7 dias (janela deslizante) + o que vem nos próximos 7.
// Só leitura sobre dados que já existem - sem schema novo.
// Quantas linhas cada lista da revisao semanal devolve no maximo.
const WEEKLY_REVIEW_MAX_COMPLETED = 100;
const WEEKLY_REVIEW_MAX_POSTPONED = 20;
const WEEKLY_REVIEW_MAX_UPCOMING = 30;

@Injectable()
export class WeeklyReviewService {
  constructor(private readonly prisma: PrismaService) {}

  async build(userId: string, now = new Date()): Promise<WeeklyReview> {
    const from = new Date(now.getTime() - 7 * DAY_MS);
    const to = new Date(now.getTime() + 7 * DAY_MS);
    const startOfToday = new Date(now);
    startOfToday.setUTCHours(0, 0, 0, 0);

    const area = { select: { name: true } } as const;

    const [completed, postponed, overdueCount, sessions, upcoming] =
      await Promise.all([
        this.prisma.task.findMany({
          where: { userId, completedAt: { gte: from, lte: now } },
          select: { id: true, title: true, completedAt: true, area },
          orderBy: { completedAt: 'desc' },
          take: WEEKLY_REVIEW_MAX_COMPLETED,
        }),
        this.prisma.task.findMany({
          where: {
            userId,
            progressStatus: { not: 'COMPLETED' },
            postponedCount: { gt: 0 },
            updatedAt: { gte: from },
          },
          select: { id: true, title: true, postponedCount: true, area },
          orderBy: { postponedCount: 'desc' },
          take: WEEKLY_REVIEW_MAX_POSTPONED,
        }),
        this.prisma.task.count({
          where: {
            userId,
            progressStatus: { not: 'COMPLETED' },
            date: { lt: startOfToday },
            // Mesma regra dos atrasos: sem prazo real ou bloqueada nao conta.
            ...ACTIONABLE_DEADLINE_WHERE,
          },
        }),
        this.prisma.studySession.findMany({
          where: { userId, startedAt: { gte: from }, endedAt: { not: null } },
          select: {
            startedAt: true,
            endedAt: true,
            focusRating: true,
            area,
          },
        }),
        this.prisma.task.findMany({
          where: {
            userId,
            progressStatus: { not: 'COMPLETED' },
            date: { gte: startOfToday, lte: to },
          },
          select: { id: true, title: true, date: true, area },
          orderBy: { date: 'asc' },
          take: WEEKLY_REVIEW_MAX_UPCOMING,
        }),
      ]);

    let studyMinutes = 0;
    const byArea = new Map<string, number>();
    const ratings: number[] = [];
    for (const session of sessions) {
      const minutes = Math.min(
        MAX_SESSION_MINUTES,
        Math.max(
          0,
          ((session.endedAt as Date).getTime() - session.startedAt.getTime()) /
            MS_PER_MINUTE,
        ),
      );
      studyMinutes += minutes;
      const name = session.area?.name ?? 'No area';
      byArea.set(name, (byArea.get(name) ?? 0) + minutes);
      if (session.focusRating !== null) ratings.push(session.focusRating);
    }

    return {
      from: from.toISOString(),
      to: now.toISOString(),
      completed: completed.map((t) => ({
        id: t.id,
        title: t.title,
        areaName: t.area?.name ?? null,
        completedAt: (t.completedAt as Date).toISOString(),
      })),
      postponed: postponed.map((t) => ({
        id: t.id,
        title: t.title,
        areaName: t.area?.name ?? null,
        postponedCount: t.postponedCount,
      })),
      overdueCount,
      studyMinutes: Math.round(studyMinutes),
      studyByArea: [...byArea.entries()]
        .map(([areaName, minutes]) => ({
          areaName,
          minutes: Math.round(minutes),
        }))
        .sort((a, b) => b.minutes - a.minutes),
      focusAverage:
        ratings.length > 0
          ? roundTo(ratings.reduce((a, b) => a + b, 0) / ratings.length)
          : null,
      upcoming: upcoming.map((t) => ({
        id: t.id,
        title: t.title,
        areaName: t.area?.name ?? null,
        date: t.date.toISOString(),
      })),
    };
  }
}
