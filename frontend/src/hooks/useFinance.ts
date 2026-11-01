import { useCallback, useEffect, useState } from 'react';
import { isAxiosError } from 'axios';
import {
  HTTP_CONFLICT,
  HTTP_TOO_MANY_REQUESTS,
  createFinanceAccount,
  createFinanceEntry,
  createFinanceGoal,
  createFinanceHolding,
  deleteFinanceAccount,
  deleteFinanceEntry,
  deleteFinanceGoal,
  deleteFinanceHolding,
  getFinance,
  refreshFinanceHoldings,
  updateFinanceAccount,
  updateFinanceEntry,
  updateFinanceGoal,
  updateFinanceHolding,
  updateFinanceSettings,
  type FinanceAccountInput,
  type FinanceEntryInput,
  type FinanceGoalInput,
  type FinanceHoldingInput,
  type FinanceHoldingUpdate,
  type FinanceSettings,
  type FinanceSummary,
} from '../api/financeService';
import { useFeedback } from '../context/useFeedback';
import { translateNow } from '../i18n/translate';
import { KEY_CONFLICT, type SubmitOutcome } from '../lib/idempotency';

// Separador Finance de um mes. Depois de cada alteracao volta a pedir o
// resumo: as somas, saldos e projecoes sao feitos no backend.
export function useFinance(month: string) {
  const { notify } = useFeedback();
  const [data, setData] = useState<FinanceSummary | null>(null);
  const [error, setError] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  // Muda a cada escrita, para a analitica voltar a pedir os dados.
  const [version, setVersion] = useState(0);

  const reload = useCallback(async () => {
    try {
      setData(await getFinance(month));
      setError(false);
    } catch {
      setError(true);
    }
  }, [month]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // true quando correu bem (para o formulario limpar).
  const run = useCallback(
    async (action: () => Promise<unknown>): Promise<boolean> => {
      try {
        await action();
        await reload();
        setVersion((v) => v + 1);
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
        return true;
      } catch (err) {
        if (isAxiosError(err) && err.response?.status === HTTP_CONFLICT) return KEY_CONFLICT;
        notify(translateNow('finance.saveError'), 'error');
        return false;
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
      const limited = isAxiosError(err) && err.response?.status === HTTP_TOO_MANY_REQUESTS;
      notify(translateNow(limited ? 'finance.refreshRateLimited' : 'finance.refreshError'), 'error');
    } finally {
      setIsRefreshing(false);
    }
  }, [notify, reload]);

  return {
    data,
    error,
    version,
    isRefreshing,
    refreshPrices,
    saveSettings: (changes: Partial<FinanceSettings>) => run(() => updateFinanceSettings(changes)),
    addEntry: (input: FinanceEntryInput, key: string) => runCreate(() => createFinanceEntry(input, key)),
    updateEntry: (id: string, changes: Partial<FinanceEntryInput>) => run(() => updateFinanceEntry(id, changes)),
    removeEntry: (id: string) => run(() => deleteFinanceEntry(id)),
    addAccount: (input: FinanceAccountInput, key: string) => runCreate(() => createFinanceAccount(input, key)),
    updateAccount: (id: string, changes: Partial<FinanceAccountInput>) => run(() => updateFinanceAccount(id, changes)),
    removeAccount: (id: string) => run(() => deleteFinanceAccount(id)),
    addHolding: (input: FinanceHoldingInput, key: string) => runCreate(() => createFinanceHolding(input, key)),
    updateHolding: (id: string, changes: FinanceHoldingUpdate) => run(() => updateFinanceHolding(id, changes)),
    removeHolding: (id: string) => run(() => deleteFinanceHolding(id)),
    addGoal: (input: FinanceGoalInput, key: string) => runCreate(() => createFinanceGoal(input, key)),
    updateGoal: (id: string, changes: Partial<FinanceGoalInput>) => run(() => updateFinanceGoal(id, changes)),
    removeGoal: (id: string) => run(() => deleteFinanceGoal(id)),
  };
}

export type FinanceActions = ReturnType<typeof useFinance>;
