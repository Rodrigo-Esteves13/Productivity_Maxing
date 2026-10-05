// Regras para o intervalo [inicio, fim] de uma sessao escrita ou corrigida
// a mao. Puras (sem BD) para se testarem a parte. Existem porque o tempo de
// estudo alimenta as previsoes: um intervalo absurdo estraga-as.

export const MAX_SESSION_MINUTES = 16 * 60;
// Quanto para tras se pode registar uma sessao.
export const MAX_BACKDATE_DAYS = 400;
// Tolerancia a relogios ligeiramente desfasados entre browser e servidor.
const FUTURE_TOLERANCE_MS = 60_000;
const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 24 * 60 * MS_PER_MINUTE;

/** Mensagem de erro, ou null se o intervalo e aceitavel. */
export function validateSessionWindow(
  start: Date,
  end: Date,
  now: Date,
): string | null {
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 'Invalid date.';
  }
  if (end.getTime() <= start.getTime()) {
    return 'The end must be after the start.';
  }
  if (end.getTime() > now.getTime() + FUTURE_TOLERANCE_MS) {
    return 'A session cannot end in the future.';
  }
  const minutes = (end.getTime() - start.getTime()) / MS_PER_MINUTE;
  if (minutes > MAX_SESSION_MINUTES) {
    return `A session cannot be longer than ${MAX_SESSION_MINUTES / 60} hours.`;
  }
  if (start.getTime() < now.getTime() - MAX_BACKDATE_DAYS * MS_PER_DAY) {
    return `A session cannot start more than ${MAX_BACKDATE_DAYS} days ago.`;
  }
  return null;
}
