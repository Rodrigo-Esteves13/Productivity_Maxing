import type { Prisma } from '@prisma/client';

// Soma, em minutos, de sessões de estudo já terminadas. Partilhado entre
// PredictionService (treino/precisão) e StudyPlanService (tempo já
// investido em cada task), que antes teriam cada um a sua cópia.
export function sumSessionMinutes(
  sessions: { startedAt: Date; endedAt: Date | null }[],
): number {
  let total = 0;
  for (const session of sessions) {
    if (!session.endedAt) continue;
    total += (session.endedAt.getTime() - session.startedAt.getTime()) / 60_000;
  }
  return Math.round(Math.max(0, total));
}

/**
 * Tempo de estudo de uma task: as sessoes reais, e so se nao houver
 * nenhuma, o tempo aproximado escrito de memoria (recalledStudyMinutes).
 */
export function resolveStudyMinutes(
  sessions: { startedAt: Date; endedAt: Date | null }[],
  recalledStudyMinutes: number | null | undefined,
): number {
  const logged = sumSessionMinutes(sessions);
  if (logged > 0) return logged;
  return recalledStudyMinutes && recalledStudyMinutes > 0
    ? recalledStudyMinutes
    : 0;
}

/**
 * Filtro "esta task tem tempo de estudo conhecido" (sessao terminada ou
 * tempo recordado). Usar dentro de AND: [...], porque quem chama pode ja
 * ter o seu proprio OR.
 */
export function hasStudyTimeWhere(): Prisma.TaskWhereInput {
  return {
    OR: [
      { studySessions: { some: { endedAt: { not: null } } } },
      { recalledStudyMinutes: { gt: 0 } },
    ],
  };
}
