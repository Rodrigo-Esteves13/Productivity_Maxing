import type { PrismaService } from '../prisma/prisma.service';
import { MS_PER_DAY } from '../common/time.constants';
import {
  AREA_SESSION_WINDOW_DAYS,
  attributeSessions,
} from './session-attribution.util';

export interface HistorySession {
  taskId: string | null;
  areaId: string | null;
  startedAt: Date;
  endedAt: Date | null;
  focusRating: number | null;
}

/** Uma task ja avaliada com todo o estudo que lhe pertence. */
export interface GradedTaskHistory {
  id: string;
  title: string;
  areaId: string;
  areaName: string;
  areaColorHex: string;
  date: Date;
  realGrade: number;
  gradeScale: string | null;
  recalledStudyMinutes: number | null;
  sessions: HistorySession[];
}

/**
 * Tasks avaliadas (as mais recentes primeiro) com as sessoes atribuidas a
 * cada uma (ver session-attribution.util.ts). Fonte unica das previsoes de
 * nota, do efeito do foco e do grafico de pontos. Tres consultas, sem N+1.
 */
export async function loadGradedHistory(
  prisma: Pick<PrismaService, 'task' | 'studySession'>,
  userId: string,
  options: { take?: number } = {},
): Promise<GradedTaskHistory[]> {
  const graded = await prisma.task.findMany({
    where: { userId, realGrade: { not: null } },
    orderBy: { date: 'desc' },
    take: options.take,
    select: {
      id: true,
      title: true,
      areaId: true,
      date: true,
      realGrade: true,
      recalledStudyMinutes: true,
      area: { select: { name: true, colorHex: true } },
      period: { select: { program: { select: { gradeScale: true } } } },
    },
  });
  if (graded.length === 0) return [];

  const gradedIds = graded.map((task) => task.id);
  const areaIds = [...new Set(graded.map((task) => task.areaId))];
  const times = graded.map((task) => task.date.getTime());
  const from = new Date(
    Math.min(...times) - AREA_SESSION_WINDOW_DAYS * MS_PER_DAY,
  );
  const to = new Date(Math.max(...times) + MS_PER_DAY);

  const [candidates, sessions] = await Promise.all([
    // Avaliacoes das mesmas cadeiras no periodo: uma sessao so da cadeira
    // vai para o prazo mais proximo, mesmo que esse ainda nao tenha nota.
    prisma.task.findMany({
      where: {
        userId,
        areaId: { in: areaIds },
        date: { gte: from, lte: to },
        OR: [{ weightPercentage: { gt: 0 } }, { realGrade: { not: null } }],
      },
      select: { id: true, areaId: true, date: true },
    }),
    prisma.studySession.findMany({
      where: {
        userId,
        endedAt: { not: null },
        OR: [
          { taskId: { in: gradedIds } },
          {
            taskId: null,
            areaId: { in: areaIds },
            startedAt: { gte: from, lte: to },
          },
        ],
      },
      select: {
        taskId: true,
        areaId: true,
        startedAt: true,
        endedAt: true,
        focusRating: true,
      },
    }),
  ]);

  const candidateIds = new Set(candidates.map((task) => task.id));
  const attributionTasks = [
    ...candidates,
    ...graded.filter((task) => !candidateIds.has(task.id)),
  ];
  const byTask = attributeSessions(attributionTasks, sessions);

  return graded.flatMap((task) =>
    task.realGrade === null
      ? []
      : [
          {
            id: task.id,
            title: task.title,
            areaId: task.areaId,
            areaName: task.area.name,
            areaColorHex: task.area.colorHex,
            date: task.date,
            realGrade: task.realGrade,
            gradeScale: task.period?.program.gradeScale ?? null,
            recalledStudyMinutes: task.recalledStudyMinutes,
            sessions: byTask.get(task.id) ?? [],
          },
        ],
  );
}
