import { MS_PER_MINUTE } from './timeConstants';
import type { HeatmapCell } from '../types/models';
import { APP_TIME_ZONE } from './dateKey';

// "Agora e uma boa hora para estudar?", a partir do heatmap. O heatmap
// agrupa por dia da semana e blocos de 4h em hora de Lisboa (ver
// getHeatmap no backend), por isso o bloco de "agora" usa a mesma
// referencia para bater certo com os dados.

const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const lisbonWeekdayHour = new Intl.DateTimeFormat('en-US', {
  timeZone: APP_TIME_ZONE,
  weekday: 'short',
  hour: '2-digit',
  hourCycle: 'h23',
});

/** Dia da semana (0=Domingo) e hora (0-23) de um instante em hora de Lisboa. */
export function toLisbonWeekdayHour(at: Date): { dayOfWeek: number; hour: number } {
  const parts = lisbonWeekdayHour.formatToParts(at);
  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? 'Sun';
  return { dayOfWeek: WEEKDAY_INDEX[weekday] ?? 0, hour: Number(parts.find((p) => p.type === 'hour')?.value ?? 0) };
}

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
  const { dayOfWeek, hour } = toLisbonWeekdayHour(now);
  const bucket = Math.floor(hour / HOUR_BUCKET_SIZE);

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
