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

// Peso de cada nota de concentracao (1 a 5, dada ao parar a sessao) no tempo
// de estudo "efetivo". So desconta minutos dispersos: 4 e 5 contam por
// inteiro e uma sessao SEM nota (nao respondeu, ou criada a mao) tambem,
// para quem nao avalia nunca ficar prejudicado. Valores aqui, num so sitio,
// para ajustar a curva sem mexer nos servicos.
export const FOCUS_WEIGHT_BY_RATING: Readonly<Record<number, number>> = {
  1: 0.5,
  2: 0.7,
  3: 0.85,
  4: 1,
  5: 1,
};
const NEUTRAL_FOCUS_WEIGHT = 1;

export function focusWeight(rating: number | null | undefined): number {
  if (rating === null || rating === undefined) return NEUTRAL_FOCUS_WEIGHT;
  return FOCUS_WEIGHT_BY_RATING[rating] ?? NEUTRAL_FOCUS_WEIGHT;
}

export interface RatedSession {
  startedAt: Date;
  endedAt: Date | null;
  focusRating?: number | null;
}

/** Como sumSessionMinutes, mas cada sessao pesa pela sua concentracao. */
export function sumFocusedSessionMinutes(sessions: RatedSession[]): number {
  let total = 0;
  for (const session of sessions) {
    if (!session.endedAt) continue;
    const minutes =
      (session.endedAt.getTime() - session.startedAt.getTime()) / 60_000;
    total += minutes * focusWeight(session.focusRating);
  }
  return Math.round(Math.max(0, total));
}

/**
 * Como resolveStudyMinutes, mas com as sessoes ponderadas pela concentracao.
 * Usar onde a pergunta e "quanto estudo EFETIVO esta task precisou" (treino
 * das previsoes, plano de estudo, projecao de notas). Para "quanto tempo
 * passei de relogio" (precisao das estimativas, calibracao) continua a
 * usar-se resolveStudyMinutes.
 */
export function resolveFocusedStudyMinutes(
  sessions: RatedSession[],
  recalledStudyMinutes: number | null | undefined,
): number {
  const logged = sumFocusedSessionMinutes(sessions);
  if (logged > 0) return logged;
  return recalledStudyMinutes && recalledStudyMinutes > 0
    ? recalledStudyMinutes
    : 0;
}
