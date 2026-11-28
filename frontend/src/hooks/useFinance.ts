import { useCallback, useEffect, useRef, useState } from 'react';
import { getHttpStatus } from '../lib/httpError';
import {
  HTTP_CONFLICT,
  HTTP_TOO_MANY_REQUESTS,
  addFinanceOwedPayment,
  createFinanceAccount,
  createFinanceEntry,
  createFinanceGoal,
  createFinanceHolding,
  bulkDeleteFinanceEntries,
  deleteFinanceAccount,
  restoreFinanceAccount,
  restoreFinanceEntries,
  deleteFinanceGoal,
  deleteFinanceHolding,
  getFinance,
  getFinanceOwedPayments,
  refreshFinanceHoldings,
  updateFinanceAccount,
  updateFinanceEntry,
  updateFinanceGoal,
  updateFinanceHolding,
  updateFinanceSettings,
  undoFinanceOwedPayment,
  type FinanceAccountInput,
  type FinanceEntryInput,
  type FinanceGoalInput,
  type FinanceOwedPaymentRow,
  type FinanceHoldingInput,
  type FinanceHoldingUpdate,
  type FinanceSettings,
  type FinanceSummary,
} from '../api/financeService';
import { useFeedback } from '../context/useFeedback';
import { translateNow } from '../i18n/translate';
import { KEY_CONFLICT, type SubmitOutcome } from '../lib/idempotency';
import { accountToInput, goalToInput, holdingToInput, isUndoGone, undoResultKey } from '../lib/financeUndo';
import { newRequestId } from '../lib/idempotency';
import { useUndoableDelete } from './useUndoableDelete';

// Separador Finance de um mes. Depois de cada alteracao volta a pedir o
// resumo: as somas, saldos e projecoes sao feitos no backend.
export function useFinance(month: string) {
  const { notify } = useFeedback();
  const offerUndoDelete = useUndoableDelete();
  const [loaded, setLoaded] = useState<{ month: string; summary: FinanceSummary } | null>(null);
  const [error, setError] = useState(false);
  // Pedido mais recente ganha: um mes antigo que responde tarde nao pisa o atual.
  const requestIdRef = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);
  // Dados so do mes pedido: ao mudar de mes ficam null (skeleton) em vez de
  // mostrar os valores do mes anterior sob o titulo do novo.
  const data = loaded && loaded.month === month ? loaded.summary : null;
  const [isRefreshing, setIsRefreshing] = useState(false);
  // Muda a cada escrita, para a analitica voltar a pedir os dados.
  const [version, setVersion] = useState(0);
  // So muda quando uma escrita pode tocar nas dividas/pagamentos (nao a cada escrita).
  const [owedVersion, setOwedVersion] = useState(0);

  const reload = useCallback(async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const requestId = ++requestIdRef.current;
    try {
      const summary = await getFinance(month, controller.signal);
      if (requestId !== requestIdRef.current) return;
      setLoaded({ month, summary });
      setError(false);
    } catch {
      if (requestId !== requestIdRef.current || controller.signal.aborted) return;
      setError(true);
    }
  }, [month]);

  useEffect(() => {
    void reload();
    return () => controllerRef.current?.abort();
  }, [reload]);

  // Historico de pagamentos recebidos; so volta a pedir quando as dividas mudam (owedVersion).
  const [owedPayments, setOwedPayments] = useState<FinanceOwedPaymentRow[]>([]);
  useEffect(() => {
    let active = true;
    getFinanceOwedPayments()
      .then((rows) => {
        if (active) setOwedPayments(rows);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [owedVersion]);

  // true quando correu bem (para o formulario limpar).
  // `quiet`: sem toast de sucesso (o apagar ja mostra o seu, com Anular).
  const run = useCallback(
    async (action: () => Promise<unknown>, touchesDebts = false, quiet = false): Promise<boolean> => {
      try {
        await action();
        await reload();
        setVersion((v) => v + 1);
        if (touchesDebts) setOwedVersion((v) => v + 1);
        if (!quiet) notify(translateNow('quickWins.financeSaved'), 'success');
        return true;
      } catch {
        notify(translateNow('finance.saveError'), 'error');
        return false;
      }
    },
    [notify, reload],
  );

  // Criacao com Idempotency-Key: 409 (chave ja usada) nao e erro para a pessoa,
  // devolve KEY_CONFLICT para o formulario gerar chave nova e repetir.
  const runCreate = useCallback(
    async (action: () => Promise<unknown>): Promise<SubmitOutcome> => {
      try {
        await action();
        await reload();
        setVersion((v) => v + 1);
        notify(translateNow('quickWins.financeSaved'), 'success');
        return true;
      } catch (err) {
        if (getHttpStatus(err) === HTTP_CONFLICT) return KEY_CONFLICT;
        notify(translateNow('finance.saveError'), 'error');
        return false;
      }
    },
    [notify, reload],
  );

  // Pagamento parcial: 409 aqui e "a divida mudou" (outro separador ja pagou),
  // nao chave gasta, por isso NAO repete com chave nova; recarrega e avisa.
  const runPayment = useCallback(
    async (action: () => Promise<unknown>): Promise<boolean> => {
      try {
        await action();
        await reload();
        setVersion((v) => v + 1);
        setOwedVersion((v) => v + 1);
        notify(translateNow('quickWins.financeSaved'), 'success');
        return true;
      } catch (err) {
        const changed = getHttpStatus(err) === HTTP_CONFLICT;
        if (changed) {
          await reload();
          setVersion((v) => v + 1);
          setOwedVersion((v) => v + 1);
        }
        notify(translateNow(changed ? 'financeFixes.owed.conflict' : 'finance.saveError'), 'error');
        return false;
      }
    },
    [notify, reload],
  );

  // Desfazer pagamento: o erro sobe para o dialogo de confirmacao mostrar.
  // 404 (ja desfeito noutro separador) tambem recarrega a lista.
  const undoOwedPayment = useCallback(
    async (paymentId: string): Promise<void> => {
      try {
        const result = await undoFinanceOwedPayment(paymentId);
        await reload();
        setVersion((v) => v + 1);
        setOwedVersion((v) => v + 1);
        const key = undoResultKey(result);
        notify(translateNow(key), key === 'financeUndo.done' ? 'success' : 'info');
      } catch (err) {
        if (isUndoGone(err)) {
          await reload();
          setVersion((v) => v + 1);
          setOwedVersion((v) => v + 1);
        }
        throw err;
      }
    },
    [notify, reload],
  );

  // 429 = o limite de pedidos de precos; mensagem propria em vez do erro generico.
  const refreshPrices = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const result = await refreshFinanceHoldings();
      await reload();
      setVersion((v) => v + 1);
      if (result.failed.length > 0) notify(translateNow('finance.refreshPartial', { symbols: result.failed.join(', ') }), 'error');
    } catch (err) {
      const limited = getHttpStatus(err) === HTTP_TOO_MANY_REQUESTS;
      notify(translateNow(limited ? 'finance.refreshRateLimited' : 'finance.refreshError'), 'error');
    } finally {
      setIsRefreshing(false);
    }
  }, [notify, reload]);

  const refresh = useCallback(async () => {
    await reload();
    setVersion((v) => v + 1);
    setOwedVersion((v) => v + 1);
  }, [reload]);

  // Apaga e oferece Anular (recria o registo com os mesmos dados).
  const removeWithUndo = useCallback(
    async <T,>(
      action: () => Promise<T>,
      message: (removed: T) => string,
      restore: (removed: T) => Promise<unknown>,
      touchesDebts = false,
    ) => {
      let result: { removed: T } | null = null;
      const done = await run(
        async () => {
          result = { removed: await action() };
        },
        touchesDebts,
        true,
      );
      const outcome = result as { removed: T } | null;
      if (done && outcome) {
        offerUndoDelete({
          message: message(outcome.removed),
          restore: () => restore(outcome.removed),
          onRestored: () => void refresh(),
        });
      }
      return done;
    },
    [run, offerUndoDelete, refresh],
  );

  // Um ou varios movimentos; o backend devolve o necessario para anular
  // (incluindo as ligacoes a pagamentos de dividas).
  const removeEntries = (ids: string[]) =>
    removeWithUndo(
      () => bulkDeleteFinanceEntries(ids),
      (removed) => {
        if (removed.length > 1) return translateNow('f7money.entriesDeleted', { count: removed.length });
        return translateNow(removed[0]?.frequency ? 'ux4fin.undo.rule' : 'undoDelete.finance');
      },
      restoreFinanceEntries,
      true,
    );

  return {
    data,
    error,
    /** Volta a pedir o mes atual (botao "Tentar de novo"). */
    retry: reload,
    version,
    owedPayments,
    isRefreshing,
    refreshPrices,
    // Depois de uma escrita feita fora destas acoes (importacao CSV).
    refresh,
    saveSettings: (changes: Partial<FinanceSettings>) => run(() => updateFinanceSettings(changes)),
    addEntry: (input: FinanceEntryInput, key: string) => runCreate(() => createFinanceEntry(input, key)),
    updateEntry: (id: string, changes: Partial<FinanceEntryInput>) =>
      run(() => updateFinanceEntry(id, changes), true),
    addOwedPayment: (id: string, payment: { amountCents: number; paidAt: string }, key?: string) =>
      runPayment(() => addFinanceOwedPayment(id, payment, key)),
    undoOwedPayment,
    removeEntry: (id: string) => removeEntries([id]),
    removeEntries,
    addAccount: (input: FinanceAccountInput, key: string) => runCreate(() => createFinanceAccount(input, key)),
    updateAccount: (id: string, changes: Partial<FinanceAccountInput>) => run(() => updateFinanceAccount(id, changes)),
    removeAccount: async (id: string) => {
      const account = data?.accounts.find((a) => a.id === id);
      if (!account) return run(() => deleteFinanceAccount(id));
      return removeWithUndo(
        () => deleteFinanceAccount(id),
        () => translateNow('f7money.accountDeleted'),
        (links) => restoreFinanceAccount(id, accountToInput(account), links),
      );
    },
    addHolding: (input: FinanceHoldingInput, key: string) => runCreate(() => createFinanceHolding(input, key)),
    updateHolding: (id: string, changes: FinanceHoldingUpdate) => run(() => updateFinanceHolding(id, changes)),
    removeHolding: async (id: string) => {
      const holding = data?.holdings.find((h) => h.id === id);
      if (!holding) return run(() => deleteFinanceHolding(id));
      return removeWithUndo(
        () => deleteFinanceHolding(id),
        () => translateNow('f7money.holdingDeleted'),
        () => createFinanceHolding(holdingToInput(holding), newRequestId()),
      );
    },
    addGoal: (input: FinanceGoalInput, key: string) => runCreate(() => createFinanceGoal(input, key)),
    updateGoal: (id: string, changes: Partial<FinanceGoalInput>) => run(() => updateFinanceGoal(id, changes)),
    removeGoal: async (id: string) => {
      const goal = data?.goals.find((g) => g.id === id);
      if (!goal) return run(() => deleteFinanceGoal(id));
      return removeWithUndo(
        () => deleteFinanceGoal(id),
        () => translateNow('ux4fin.undo.goal'),
        () => createFinanceGoal(goalToInput(goal), newRequestId()),
      );
    },
  };
}

export type FinanceActions = ReturnType<typeof useFinance>;
