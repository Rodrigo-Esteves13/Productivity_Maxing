// Materializa as regras em ocorrencias e agrupa-as por semana/mes. Puro.

import {
  FinanceEntryKind,
  FinanceFrequency,
  type FinanceEntry,
} from '@prisma/client';
import { addUtcDays, parseDateKey, toDateKey } from '../common/date-key.util';
import { occurrencesInRange, resolveFrequency } from './finance-schedule.util';
import {
  ANALYTICS_TOP_CATEGORIES,
  MONTHS_PER_YEAR,
  PERCENT_DECIMALS,
  PERCENT_SCALE,
  WEEKS_PER_YEAR,
  type AnalyticsGranularity,
} from './finance.constants';

export type EntryRow = Pick<
  FinanceEntry,
  | 'id'
  | 'kind'
  | 'amountCents'
  | 'category'
  | 'note'
  | 'date'
  | 'recurring'
  | 'frequency'
  | 'payDayRule'
  | 'payDay'
  | 'endDate'
  | 'accountId'
>;

export interface FinanceOccurrence {
  entryId: string;
  /** YYYY-MM-DD (dia de Lisboa). */
  date: string;
  kind: FinanceEntryKind;
  amountCents: number;
  category: string;
  note: string | null;
  accountId: string | null;
  frequency: FinanceFrequency | null;
  /** true = ainda nao aconteceu (data depois de hoje). */
  projected: boolean;
}

/** Ocorrencias de todas as entradas em [from, to), por data. */
export function materialize(
  entries: EntryRow[],
  from: Date,
  to: Date,
  today: Date,
): FinanceOccurrence[] {
  const out: FinanceOccurrence[] = [];
  for (const e of entries) {
    const frequency = resolveFrequency(e);
    for (const d of occurrencesInRange(e, from, to)) {
      out.push({
        entryId: e.id,
        date: toDateKey(d),
        kind: e.kind,
        amountCents: e.amountCents,
        category: e.category,
        note: e.note,
        accountId: e.accountId,
        frequency,
        projected: d > today,
      });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/** Soma liquida (entradas - saidas). */
export function netOf(occurrences: FinanceOccurrence[]): number {
  return occurrences.reduce(
    (sum, o) =>
      sum +
      (o.kind === FinanceEntryKind.INCOME ? o.amountCents : -o.amountCents),
    0,
  );
}

const DAYS_PER_WEEK = 7;
const MONDAY_OFFSET = 6;
const MONTH_KEY_LENGTH = 'YYYY-MM'.length;

export const monthKey = (d: Date) => toDateKey(d).slice(0, MONTH_KEY_LENGTH);

interface BucketShape {
  start: (d: Date) => Date;
  next: (start: Date) => Date;
  key: (start: Date) => string;
}

// Semanas comecam a segunda (ISO). A chave da semana e a data da segunda.
const BUCKETS: Record<AnalyticsGranularity, BucketShape> = {
  week: {
    start: (d) =>
      addUtcDays(d, -((d.getUTCDay() + MONDAY_OFFSET) % DAYS_PER_WEEK)),
    next: (s) => addUtcDays(s, DAYS_PER_WEEK),
    key: toDateKey,
  },
  month: {
    start: (d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)),
    next: (s) => new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth() + 1, 1)),
    key: monthKey,
  },
};

export interface AnalyticsBucket {
  /** YYYY-MM (mes) ou YYYY-MM-DD da segunda-feira (semana). */
  key: string;
  /** Primeiro e ultimo dia (inclusive) do balde, cortados a [from, to]. */
  start: string;
  end: string;
  incomeCents: number;
  expenseCents: number;
  netCents: number;
  /** Parte de income/expense que ainda nao aconteceu. */
  projectedIncomeCents: number;
  projectedExpenseCents: number;
  expensesByCategory: Record<string, number>;
}

/** Baldes de [from, to) (to exclusivo) com as somas das ocorrencias. */
export function bucketize(
  occurrences: FinanceOccurrence[],
  from: Date,
  to: Date,
  granularity: AnalyticsGranularity,
): AnalyticsBucket[] {
  const shape = BUCKETS[granularity];
  const buckets: AnalyticsBucket[] = [];
  const byKey = new Map<string, AnalyticsBucket>();
  for (let s = shape.start(from); s < to; s = shape.next(s)) {
    const end = shape.next(s);
    const bucket: AnalyticsBucket = {
      key: shape.key(s),
      start: toDateKey(s < from ? from : s),
      end: toDateKey(addUtcDays(end < to ? end : to, -1)),
      incomeCents: 0,
      expenseCents: 0,
      netCents: 0,
      projectedIncomeCents: 0,
      projectedExpenseCents: 0,
      expensesByCategory: {},
    };
    buckets.push(bucket);
    byKey.set(bucket.key, bucket);
  }
  for (const o of occurrences) {
    const day = parseDateKey(o.date);
    const bucket = byKey.get(shape.key(shape.start(day)));
    if (!bucket) continue;
    if (o.kind === FinanceEntryKind.INCOME) {
      bucket.incomeCents += o.amountCents;
      if (o.projected) bucket.projectedIncomeCents += o.amountCents;
    } else {
      bucket.expenseCents += o.amountCents;
      if (o.projected) bucket.projectedExpenseCents += o.amountCents;
      bucket.expensesByCategory[o.category] =
        (bucket.expensesByCategory[o.category] ?? 0) + o.amountCents;
    }
    bucket.netCents = bucket.incomeCents - bucket.expenseCents;
  }
  return buckets;
}

export interface TopCategory {
  category: string;
  expenseCents: number;
  /** Percentagem do total de despesas do intervalo (2 casas). */
  sharePercent: number;
}

export function topCategories(
  buckets: AnalyticsBucket[],
  limit = ANALYTICS_TOP_CATEGORIES,
): TopCategory[] {
  const totals: Record<string, number> = {};
  for (const b of buckets) {
    for (const [category, cents] of Object.entries(b.expensesByCategory)) {
      totals[category] = (totals[category] ?? 0) + cents;
    }
  }
  const all = Object.values(totals).reduce((a, b) => a + b, 0);
  const scale = 10 ** PERCENT_DECIMALS;
  return Object.entries(totals)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([category, expenseCents]) => ({
      category,
      expenseCents,
      sharePercent: all
        ? Math.round((expenseCents / all) * PERCENT_SCALE * scale) / scale
        : 0,
    }));
}

// Custo mensal equivalente por frequencia (semanal: 52/12 por mes).
const MONTHLY_FACTOR: Record<FinanceFrequency, number> = {
  WEEKLY: WEEKS_PER_YEAR / MONTHS_PER_YEAR,
  MONTHLY: 1,
  YEARLY: 1 / MONTHS_PER_YEAR,
};

export function monthlyCostCents(
  amountCents: number,
  frequency: FinanceFrequency,
): number {
  return Math.round(amountCents * MONTHLY_FACTOR[frequency]);
}
