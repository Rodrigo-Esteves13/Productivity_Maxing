import type { FinanceOccurrence, FinanceSummary } from '../api/financeService';

export const SNAPSHOT_RENEWAL_WINDOW_DAYS = 7;
const SUBSCRIPTIONS_CATEGORY = 'SUBSCRIPTIONS';
const MS_PER_DAY = 86_400_000;

/** YYYY-MM-DD + dias -> YYYY-MM-DD (aritmetica em UTC, sem saltos de fuso). */
function addDays(dateKey: string, days: number): string {
  return new Date(Date.parse(`${dateKey}T00:00:00Z`) + days * MS_PER_DAY).toISOString().slice(0, 10);
}

/**
 * Proxima renovacao de subscricao (despesa projetada da categoria
 * SUBSCRIPTIONS) entre hoje e hoje + `windowDays`, ou null.
 */
export function nextSubscriptionRenewal(
  occurrences: FinanceOccurrence[],
  today: string,
  windowDays: number = SNAPSHOT_RENEWAL_WINDOW_DAYS,
): FinanceOccurrence | null {
  const limit = addDays(today, windowDays);
  let best: FinanceOccurrence | null = null;
  for (const occ of occurrences) {
    if (!occ.projected || occ.kind !== 'EXPENSE' || occ.category !== SUBSCRIPTIONS_CATEGORY) continue;
    if (occ.date < today || occ.date > limit) continue;
    if (!best || occ.date < best.date) best = occ;
  }
  return best;
}

/**
 * Mes (YYYY-MM) que a janela de renovacoes tambem apanha, quando hoje +
 * `windowDays` ja cai no mes seguinte; senao null (basta o mes atual).
 */
export function renewalSpilloverMonth(today: string, windowDays: number = SNAPSHOT_RENEWAL_WINDOW_DAYS): string | null {
  const limitMonth = addDays(today, windowDays).slice(0, 7);
  return limitMonth === today.slice(0, 7) ? null : limitMonth;
}

/** Ocorrencias do mes atual mais as do mes seguinte (se houver), sem repetidas. */
export function mergeRenewalOccurrences(current: FinanceOccurrence[], next: FinanceOccurrence[] | null): FinanceOccurrence[] {
  if (!next || next.length === 0) return current;
  const seen = new Set(current.map((o) => `${o.entryId}|${o.date}`));
  return [...current, ...next.filter((o) => !seen.has(`${o.entryId}|${o.date}`))];
}

/** Soma dos valores em atraso (valor de hoje) e quantos sao. */
export function overdueOwed(owed: FinanceSummary['owed']): { count: number; totalCents: number } {
  const late = owed.items.filter((item) => item.overdue);
  return { count: late.length, totalCents: late.reduce((sum, item) => sum + item.valueTodayCents, 0) };
}

/** Sem contas, entradas nem valores em divida: nada para mostrar. */
export function hasFinanceData(summary: FinanceSummary): boolean {
  return summary.accounts.length > 0 || summary.entries.length > 0 || summary.holdings.length > 0;
}
