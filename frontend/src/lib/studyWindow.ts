import type { HeatmapCell } from '../types/models';

// "Agora e uma boa hora para estudar?", a partir do heatmap. O heatmap
// agrupa por dia da semana e blocos de 4h na hora do SERVIDOR (ver
// getHeatmap no backend, normalmente UTC), por isso aqui usa-se a mesma
// referencia (UTC) para o bloco de "agora" bater certo com os dados.

export const HOUR_BUCKET_SIZE = 4;
// Abaixo disto o heatmap e ruido: nao se dizem coisas com 3 sessoes.
export const MIN_SESSIONS_FOR_HINT = 8;
const TOP_NOW = 3;
const TOP_LATER = 5;

export type StudyHint =
  | { kind: 'now'; sessionCount: number }
  | { kind: 'later'; startHour: number; endHour: number };

/** Celulas com estudo, da que mais estudo teve para a que menos. */
function rank(cells: HeatmapCell[]): HeatmapCell[] {
  return cells.filter((cell) => cell.totalMinutes > 0).sort((a, b) => b.totalMinutes - a.totalMinutes);
}

export function suggestStudyWindow(cells: HeatmapCell[], now: Date): StudyHint | null {
  const sessions = cells.reduce((sum, cell) => sum + cell.sessionCount, 0);
  if (sessions < MIN_SESSIONS_FOR_HINT) return null;

  const ranked = rank(cells);
  const dayOfWeek = now.getUTCDay();
  const bucket = Math.floor(now.getUTCHours() / HOUR_BUCKET_SIZE);

  const nowIndex = ranked.findIndex((cell) => cell.dayOfWeek === dayOfWeek && cell.hourBucket === bucket);
  if (nowIndex !== -1 && nowIndex < TOP_NOW) {
    return { kind: 'now', sessionCount: ranked[nowIndex].sessionCount };
  }

  const later = ranked
    .slice(0, TOP_LATER)
    .filter((cell) => cell.dayOfWeek === dayOfWeek && cell.hourBucket > bucket)
    .sort((a, b) => a.hourBucket - b.hourBucket)[0];
  if (later) {
    return {
      kind: 'later',
      startHour: later.hourBucket * HOUR_BUCKET_SIZE,
      endHour: (later.hourBucket + 1) * HOUR_BUCKET_SIZE,
    };
  }
  return null;
}

// ---- Progresso do dia ----

export interface SessionSpan {
  startedAt: string;
  endedAt: string | null;
}

const MS_PER_MINUTE = 60_000;

/**
 * Minutos estudados desde `dayStart` ate `now`, cortando as sessoes ao
 * intervalo (uma sessao que comecou ontem a noite so conta a parte de hoje)
 * e contando a sessao ativa ate agora. `dayStart` e a meia-noite LOCAL.
 */
export function minutesSince(dayStart: Date, now: Date, sessions: SessionSpan[]): number {
  const from = dayStart.getTime();
  const to = now.getTime();
  let totalMs = 0;
  for (const session of sessions) {
    const start = Math.max(new Date(session.startedAt).getTime(), from);
    const end = Math.min(session.endedAt ? new Date(session.endedAt).getTime() : to, to);
    if (end > start) totalMs += end - start;
  }
  return Math.round(totalMs / MS_PER_MINUTE);
}

export function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
