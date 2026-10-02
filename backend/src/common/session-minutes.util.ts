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
