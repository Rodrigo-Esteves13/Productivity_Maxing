import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const DAY_MS = 86_400_000;
// Uma sessão esquecida aberta não pode inflacionar a semana: tecto por sessão
// (as sessões esquecidas já são fechadas sozinhas, isto é só rede de segurança).
const MAX_SESSION_MINUTES = 12 * 60;

export interface WeeklyReview {
  from: string;
  to: string;
  completed: { id: string; title: string; areaName: string | null; completedAt: string }[];
  // Pendentes que foram empurradas para mais tarde alguma vez (histórico) e
  // tocadas esta semana.
  postponed: { id: string; title: string; areaName: string | null; postponedCount: number }[];
  overdueCount: number;
  studyMinutes: number;
  studyByArea: { areaName: string; minutes: number }[];
  focusAverage: number | null;
  upcoming: { id: string; title: string; areaName: string | null; date: string }[];
}

// Revisão dos últimos 7 dias (janela deslizante) + o que vem nos próximos 7.
// Só leitura sobre dados que já existem - sem schema novo.
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
          take: 100,
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
          take: 20,
        }),
        this.prisma.task.count({
          where: {
            userId,
            progressStatus: { not: 'COMPLETED' },
            date: { lt: startOfToday },
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
          take: 30,
        }),
      ]);

    let studyMinutes = 0;
    const byArea = new Map<string, number>();
    const ratings: number[] = [];
    for (const session of sessions) {
      const minutes = Math.min(
        MAX_SESSION_MINUTES,
        Math.max(0, ((session.endedAt as Date).getTime() - session.startedAt.getTime()) / 60_000),
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
        .map(([areaName, minutes]) => ({ areaName, minutes: Math.round(minutes) }))
        .sort((a, b) => b.minutes - a.minutes),
      focusAverage:
        ratings.length > 0
          ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
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
