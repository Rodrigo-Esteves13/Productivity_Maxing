import type { FinanceEntry, FinanceOccurrence } from '../api/financeService';
import { toLocalDateKey } from './dateKey';

// Mesma categoria do backend (LEISURE_CATEGORY em finance.constants.ts).
export const LEISURE_CATEGORY = 'LEISURE';
export const DEFAULT_NO_LEISURE_GOAL = 10;
export const MIN_NO_LEISURE_GOAL = 1;
export const MAX_NO_LEISURE_GOAL = 31;
// Com menos dias decorridos nao ha streak com sentido: so os pontos.
export const MIN_DAYS_FOR_STREAK = 3;

export type NoLeisureDayStatus = 'spent' | 'free' | 'future';

export interface NoLeisureDay {
  /** YYYY-MM-DD */
  key: string;
  day: number;
  status: NoLeisureDayStatus;
}

export interface NoLeisureResult {
  days: NoLeisureDay[];
  totalDays: number;
  /** Dias ja decorridos (hoje incluido) no mes; futuros nao contam. */
  elapsedDays: number;
  freeDays: number;
  currentStreak: number;
  bestStreak: number;
  /** Ha lancamentos neste mes (de qualquer categoria). */
  hasData: boolean;
}

export function clampNoLeisureGoal(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_NO_LEISURE_GOAL;
  return Math.min(MAX_NO_LEISURE_GOAL, Math.max(MIN_NO_LEISURE_GOAL, Math.round(value)));
}

/** Valor guardado -> meta. So inteiros nao negativos validos; o resto da o default. */
export function parseStoredNoLeisureGoal(raw: string | null): number {
  if (raw === null || !/^\d+$/.test(raw.trim())) return DEFAULT_NO_LEISURE_GOAL;
  return clampNoLeisureGoal(Number(raw));
}

type OccurrenceLike = Pick<FinanceOccurrence, 'entryId' | 'date' | 'kind' | 'category'>;
type EntryLike = Pick<FinanceEntry, 'id' | 'date' | 'kind' | 'category'> &
  Partial<Pick<FinanceEntry, 'recurring' | 'frequency'>>;

/**
 * Dias de lazer do mes. `occurrences` ja expande os recorrentes (o backend
 * materializa-os); `entries` so entra para os pontuais que nao vieram nas
 * ocorrencias, e o conjunto de chaves evita contar um dia duas vezes.
 */
export function computeNoLeisureDays(
  month: string,
  occurrences: OccurrenceLike[],
  entries: EntryLike[],
  now: Date,
): NoLeisureResult {
  const [year, monthNumber] = month.split('-').map(Number);
  const totalDays = new Date(year, monthNumber, 0).getDate();
  const todayKey = toLocalDateKey(now);
  const prefix = `${month}-`;

  const spentKeys = new Set<string>();
  const seenEntries = new Set<string>();
  let hasData = false;
  for (const o of occurrences) {
    seenEntries.add(o.entryId);
    if (!o.date.startsWith(prefix)) continue;
    hasData = true;
    if (o.kind === 'EXPENSE' && o.category === LEISURE_CATEGORY) spentKeys.add(o.date);
  }
  for (const e of entries) {
    const key = e.date.slice(0, 10);
    if (!key.startsWith(prefix)) continue;
    hasData = true;
    // Recorrente como no backend (finance.service.ts): flag ou frequencia.
    if (e.recurring || e.frequency != null || seenEntries.has(e.id)) continue;
    if (e.kind === 'EXPENSE' && e.category === LEISURE_CATEGORY) spentKeys.add(key);
  }

  const days: NoLeisureDay[] = [];
  for (let day = 1; day <= totalDays; day += 1) {
    const key = `${prefix}${String(day).padStart(2, '0')}`;
    const status: NoLeisureDayStatus = key > todayKey ? 'future' : spentKeys.has(key) ? 'spent' : 'free';
    days.push({ key, day, status });
  }

  const elapsed = days.filter((d) => d.status !== 'future');
  const freeDays = elapsed.filter((d) => d.status === 'free').length;

  let bestStreak = 0;
  let run = 0;
  for (const d of elapsed) {
    run = d.status === 'free' ? run + 1 : 0;
    bestStreak = Math.max(bestStreak, run);
  }

  // Termina hoje; se hoje ja tem lazer, termina ontem (o dia ainda pode correr).
  let end = elapsed.length - 1;
  if (end >= 0 && elapsed[end].status === 'spent') end -= 1;
  let currentStreak = 0;
  for (let i = end; i >= 0 && elapsed[i].status === 'free'; i -= 1) currentStreak += 1;

  return { days, totalDays, elapsedDays: elapsed.length, freeDays, currentStreak, bestStreak, hasData };
}
