// Foco medio e nota media por semana, para ver a relacao a formar-se antes
// de haver dados que cheguem para o modelo concluir. Funcoes puras.
import { addUtcDays, toDateKey } from '../common/date-key.util';
import { roundTo } from '../common/round.util';

// Quantas semanas (a acabar na atual) o grafico mostra.
export const FOCUS_TREND_WEEKS = 12;

const DAYS_PER_WEEK = 7;
const SUNDAY = 0;
const DAYS_FROM_MONDAY_TO_SUNDAY = 6;
const FULL_PERCENT = 100;
// Casas decimais do foco medio (1 a 5) e da nota em % da escala.
const TREND_DECIMALS = 1;

export interface TrendSession {
  startedAt: Date;
  minutes: number;
  // null = sessao sem foco classificado (nao entra na media).
  focus: number | null;
}

export interface TrendTask {
  // Prazo da task: a nota "pertence" a essa semana.
  date: Date;
  // Nota normalizada 0..1 na escala do curso.
  fraction: number;
}

export interface TrendWeek {
  // Segunda-feira da semana, "YYYY-MM-DD".
  weekStart: string;
  avgFocus: number | null;
  ratedMinutes: number;
  avgGradePercent: number | null;
  gradedTasks: number;
}

/** Segunda-feira (UTC) da semana de `date`; domingo conta para a semana anterior. */
export function startOfUtcWeek(date: Date): Date {
  const midnight = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const day = midnight.getUTCDay();
  const diff = day === SUNDAY ? DAYS_FROM_MONDAY_TO_SUNDAY : day - 1;
  return addUtcDays(midnight, -diff);
}

/** Segunda-feira da primeira semana do grafico (para limitar as queries). */
export function trendWindowStart(
  today: Date,
  weeks: number = FOCUS_TREND_WEEKS,
): Date {
  return addUtcDays(startOfUtcWeek(today), -(weeks - 1) * DAYS_PER_WEEK);
}

export function buildFocusTrend(
  sessions: TrendSession[],
  tasks: TrendTask[],
  today: Date,
  weeks: number = FOCUS_TREND_WEEKS,
): TrendWeek[] {
  const first = trendWindowStart(today, weeks);
  const buckets = new Map<
    string,
    { focusMinutes: number; ratedMinutes: number; fractions: number[] }
  >();
  for (let i = 0; i < weeks; i++) {
    buckets.set(toDateKey(addUtcDays(first, i * DAYS_PER_WEEK)), {
      focusMinutes: 0,
      ratedMinutes: 0,
      fractions: [],
    });
  }

  for (const session of sessions) {
    if (session.focus === null || session.minutes <= 0) continue;
    const bucket = buckets.get(toDateKey(startOfUtcWeek(session.startedAt)));
    if (!bucket) continue;
    bucket.ratedMinutes += session.minutes;
    bucket.focusMinutes += session.minutes * session.focus;
  }
  for (const task of tasks) {
    buckets
      .get(toDateKey(startOfUtcWeek(task.date)))
      ?.fractions.push(task.fraction);
  }

  return [...buckets.entries()].map(([weekStart, bucket]) => ({
    weekStart,
    avgFocus:
      bucket.ratedMinutes > 0
        ? roundTo(bucket.focusMinutes / bucket.ratedMinutes, TREND_DECIMALS)
        : null,
    ratedMinutes: Math.round(bucket.ratedMinutes),
    avgGradePercent:
      bucket.fractions.length > 0
        ? roundTo(
            (bucket.fractions.reduce((a, b) => a + b, 0) /
              bucket.fractions.length) *
              FULL_PERCENT,
            TREND_DECIMALS,
          )
        : null,
    gradedTasks: bucket.fractions.length,
  }));
}
