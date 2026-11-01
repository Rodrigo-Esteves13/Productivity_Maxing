// "Devem-me dinheiro": juros e valor esperado de uma divida a favor da
// pessoa. Puro (sem Prisma nem relogio). So aritmetica sobre os valores e a
// estimativa de risco que a propria pessoa escreveu.

import { FinanceInterestKind } from '@prisma/client';
import { addUtcDays, diffUtcDays, toDateKey } from '../common/date-key.util';
import {
  DAYS_PER_YEAR,
  MONTHS_PER_YEAR,
  OWED_LATE_SCENARIO_DAYS,
  PERCENT_SCALE,
} from './finance.constants';

// Fator de crescimento de 1 unidade em `days` dias a uma taxa anual (%).
const GROWTH: Record<
  FinanceInterestKind,
  (rate: number, days: number) => number
> = {
  NONE: () => 1,
  SIMPLE: (rate, days) => 1 + (rate / PERCENT_SCALE) * (days / DAYS_PER_YEAR),
  // Capitaliza ao mes; meses fracionados (dias / dias medios por mes).
  MONTHLY_COMPOUND: (rate, days) =>
    (1 + rate / PERCENT_SCALE / MONTHS_PER_YEAR) **
    ((days * MONTHS_PER_YEAR) / DAYS_PER_YEAR),
};

/** Tipo efetivo: sem tipo mas com taxa = SIMPLE; sem taxa = NONE. */
export function effectiveInterestKind(
  kind: FinanceInterestKind | null,
  ratePct: number | null,
): FinanceInterestKind {
  if (!ratePct) return FinanceInterestKind.NONE;
  return kind ?? FinanceInterestKind.SIMPLE;
}

/** Juros acumulados em [from, to] (0 se to <= from), arredondados ao centimo. */
export function accruedInterestCents(
  principalCents: number,
  ratePct: number | null,
  kind: FinanceInterestKind | null,
  from: Date,
  to: Date,
): number {
  const days = Math.max(0, diffUtcDays(from, to));
  const growth = GROWTH[effectiveInterestKind(kind, ratePct)](
    ratePct ?? 0,
    days,
  );
  return Math.round(principalCents * (growth - 1));
}

export interface OwedInput {
  id: string;
  amountCents: number;
  note: string | null;
  debtorName: string | null;
  /** Dia em que o dinheiro foi emprestado (inicio dos juros). */
  date: Date;
  expectedDate: Date | null;
  latePaymentRiskPct: number | null;
  interestRatePct: number | null;
  interestKind: FinanceInterestKind | null;
}

export interface OwedItem {
  entryId: string;
  debtorName: string | null;
  note: string | null;
  principalCents: number;
  since: string;
  expectedDate: string | null;
  interestKind: FinanceInterestKind;
  interestRatePct: number | null;
  latePaymentRiskPct: number;
  /** Juros desde `since` ate hoje (continuam a contar depois do prazo). */
  interestToDateCents: number;
  /** principal + juros ate hoje. */
  valueTodayCents: number;
  /** principal + juros ate ao prazo (ou ate hoje sem prazo). */
  dueValueCents: number;
  /** dueValue x (1 - risco/100). O atraso ve-se em valueToday/lateScenario. */
  expectedValueCents: number;
  overdue: boolean;
  daysLate: number;
  /** Valor se pagar OWED_LATE_SCENARIO_DAYS depois do prazo (ou de hoje, se ja passou). */
  lateScenario: { date: string; valueCents: number } | null;
}

/** Uma divida vista hoje. */
export function owedItem(o: OwedInput, today: Date): OwedItem {
  const kind = effectiveInterestKind(o.interestKind, o.interestRatePct);
  const value = (to: Date) =>
    o.amountCents +
    accruedInterestCents(o.amountCents, o.interestRatePct, kind, o.date, to);
  const valueTodayCents = value(today);
  const dueValueCents = o.expectedDate
    ? value(o.expectedDate)
    : valueTodayCents;
  const overdue = o.expectedDate !== null && o.expectedDate < today;
  const risk = o.latePaymentRiskPct ?? 0;
  const lateFrom = overdue ? today : o.expectedDate;
  const lateDate = lateFrom
    ? addUtcDays(lateFrom, OWED_LATE_SCENARIO_DAYS)
    : null;
  return {
    entryId: o.id,
    debtorName: o.debtorName,
    note: o.note,
    principalCents: o.amountCents,
    since: toDateKey(o.date),
    expectedDate: o.expectedDate ? toDateKey(o.expectedDate) : null,
    interestKind: kind,
    interestRatePct: o.interestRatePct,
    latePaymentRiskPct: risk,
    interestToDateCents: valueTodayCents - o.amountCents,
    valueTodayCents,
    dueValueCents,
    expectedValueCents: expectedValueCents(dueValueCents, risk),
    overdue,
    daysLate:
      overdue && o.expectedDate ? diffUtcDays(o.expectedDate, today) : 0,
    lateScenario: lateDate
      ? { date: toDateKey(lateDate), valueCents: value(lateDate) }
      : null,
  };
}

/** valor x (1 - risco/100), arredondado. */
export function expectedValueCents(
  valueCents: number,
  riskPct: number,
): number {
  return Math.round((valueCents * (PERCENT_SCALE - riskPct)) / PERCENT_SCALE);
}

/** Bloco `owed` do resumo. */
export function summarizeOwed(owed: OwedInput[], today: Date) {
  const items = owed.map((o) => owedItem(o, today));
  return {
    items,
    totalOwedCents: items.reduce((a, i) => a + i.valueTodayCents, 0),
    totalRiskWeightedCents: items.reduce((a, i) => a + i.expectedValueCents, 0),
    overdueCount: items.filter((i) => i.overdue).length,
  };
}
