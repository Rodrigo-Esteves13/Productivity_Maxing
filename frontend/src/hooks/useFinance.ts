import { useCallback, useEffect, useState } from 'react';
import { isAxiosError } from 'axios';
import {
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
  updateFinanceSettings,
  type FinanceAccountInput,
  type FinanceEntryInput,
  type FinanceGoalInput,
  type FinanceHoldingInput,
  type FinanceSettings,
  type FinanceSummary,
} from '../api/financeService';
import { useFeedback } from '../context/useFeedback';
import { translateNow } from '../i18n/translate';

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
    addEntry: (input: FinanceEntryInput) => run(() => createFinanceEntry(input)),
    updateEntry: (id: string, changes: Partial<FinanceEntryInput>) => run(() => updateFinanceEntry(id, changes)),
    removeEntry: (id: string) => run(() => deleteFinanceEntry(id)),
    addAccount: (input: FinanceAccountInput) => run(() => createFinanceAccount(input)),
    updateAccount: (id: string, changes: Partial<FinanceAccountInput>) => run(() => updateFinanceAccount(id, changes)),
    removeAccount: (id: string) => run(() => deleteFinanceAccount(id)),
    addHolding: (input: FinanceHoldingInput) => run(() => createFinanceHolding(input)),
    removeHolding: (id: string) => run(() => deleteFinanceHolding(id)),
    addGoal: (input: FinanceGoalInput) => run(() => createFinanceGoal(input)),
    updateGoal: (id: string, changes: Partial<Omit<FinanceGoalInput, 'kind'>>) =>
      run(() => updateFinanceGoal(id, changes)),
    removeGoal: (id: string) => run(() => deleteFinanceGoal(id)),
  };
}

export type FinanceActions = ReturnType<typeof useFinance>;
