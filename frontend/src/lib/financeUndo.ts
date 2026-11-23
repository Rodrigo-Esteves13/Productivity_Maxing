import {
  HTTP_CONFLICT,
  HTTP_NOT_FOUND,
  HTTP_TOO_MANY_REQUESTS,
  type FinanceAccount,
  type FinanceAccountInput,
  type FinanceEntry,
  type FinanceEntryInput,
  type FinanceGoal,
  type FinanceGoalInput,
  type FinanceHolding,
  type FinanceHoldingInput,
  type FinanceOwedPaymentUndoResult,
} from '../api/financeService';

// Desfazer um pagamento parcial: que mensagem (chave i18n) mostrar. Puro.

const statusOf = (err: unknown): number | undefined => {
  const status = (err as { response?: { status?: unknown } } | null)?.response?.status;
  return typeof status === 'number' ? status : undefined;
};

/** Erro do DELETE: 404 ja desfeito, 409 divida ja recebida, 429 limite. */
export function undoErrorKey(err: unknown): string {
  switch (statusOf(err)) {
    case HTTP_NOT_FOUND:
      return 'financeUndo.notFound';
    case HTTP_CONFLICT:
      return 'financeUndo.conflict';
    case HTTP_TOO_MANY_REQUESTS:
      return 'financeUndo.rateLimited';
    default:
      return 'financeUndo.error';
  }
}

/** true quando o pedido ja nao existe (outro separador desfez): recarregar. */
export const isUndoGone = (err: unknown): boolean => statusOf(err) === HTTP_NOT_FOUND;

/** Mensagem de sucesso: avisa quando a entrada ou a divida nao foram encontradas. */
export function undoResultKey(result: FinanceOwedPaymentUndoResult): string {
  if (!result.incomeEntryRemoved && !result.debtRestored) return 'financeUndo.doneOnlyPayment';
  if (!result.incomeEntryRemoved) return 'financeUndo.doneNoIncome';
  if (!result.debtRestored) return 'financeUndo.doneNoDebt';
  return 'financeUndo.done';
}

// Dados para recriar um movimento apagado (Anular depois de apagar).
export function entryToInput(entry: FinanceEntry): FinanceEntryInput {
  const rate = entry.interestRatePct === null ? null : Number(entry.interestRatePct);
  return {
    kind: entry.kind,
    amountCents: entry.amountCents,
    category: entry.category,
    note: entry.note ?? undefined,
    date: entry.date.slice(0, 10),
    frequency: entry.frequency,
    payDayRule: entry.payDayRule,
    payDay: entry.payDay,
    endDate: entry.endDate ? entry.endDate.slice(0, 10) : null,
    accountId: entry.accountId,
    skipFirstOccurrences: entry.skipFirstOccurrences,
    paidInArrearsMonths: entry.paidInArrearsMonths,
    withheldCents: entry.withheldCents,
    isOwed: entry.isOwed,
    debtorName: entry.debtorName,
    expectedDate: entry.expectedDate ? entry.expectedDate.slice(0, 10) : null,
    latePaymentRiskPct: entry.latePaymentRiskPct,
    interestRatePct: rate !== null && Number.isFinite(rate) ? rate : null,
    interestKind: entry.interestKind,
    receivedAt: entry.receivedAt,
  };
}

// Dados para recriar uma conta apagada (a moeda propria da conta nao e editavel).
export function accountToInput(account: FinanceAccount): FinanceAccountInput {
  return { name: account.name, type: account.type, balanceCents: account.balanceCents };
}

// Dados para recriar uma meta apagada.
export function goalToInput(goal: FinanceGoal): FinanceGoalInput {
  return {
    kind: goal.kind,
    name: goal.name,
    targetCents: goal.targetCents,
    savedCents: goal.savedCents,
    deadline: goal.deadline ? goal.deadline.slice(0, 10) : null,
    monthlyPlanCents: goal.monthlyPlanCents,
  };
}

// Dados para recriar um investimento apagado: simbolo, conta e quantidade
// (o custo medio nao se recria; o backend so aceita quantidade OU investido).
export function holdingToInput(holding: FinanceHolding): FinanceHoldingInput {
  return { symbol: holding.symbol, name: holding.name, accountId: holding.accountId, quantity: holding.quantity };
}
