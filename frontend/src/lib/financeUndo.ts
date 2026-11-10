import { HTTP_CONFLICT, HTTP_NOT_FOUND, HTTP_TOO_MANY_REQUESTS, type FinanceOwedPaymentUndoResult } from '../api/financeService';

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
