import { useCallback, useEffect, useState } from 'react';
import {
  createFinanceEntry,
  createFinanceGoal,
  deleteFinanceEntry,
  deleteFinanceGoal,
  getFinance,
  updateFinanceGoal,
  updateFinanceSettings,
  type FinanceEntryInput,
  type FinanceGoalInput,
  type FinanceSettings,
  type FinanceSummary,
} from '../api/financeService';
import { useFeedback } from '../context/useFeedback';
import { translateNow } from '../i18n/translate';

// Separador Finance de um mes. Depois de cada alteracao volta a pedir o
// resumo: as somas (e as entradas mensais) sao feitas no backend.
export function useFinance(month: string) {
  const { notify } = useFeedback();
  const [data, setData] = useState<FinanceSummary | null>(null);
  const [error, setError] = useState(false);

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
        return true;
      } catch {
        notify(translateNow('finance.saveError'), 'error');
        return false;
      }
    },
    [notify, reload],
  );

  return {
    data,
    error,
    saveSettings: (changes: Partial<FinanceSettings>) => run(() => updateFinanceSettings(changes)),
    addEntry: (input: FinanceEntryInput) => run(() => createFinanceEntry(input)),
    removeEntry: (id: string) => run(() => deleteFinanceEntry(id)),
    addGoal: (input: FinanceGoalInput) => run(() => createFinanceGoal(input)),
    updateGoal: (id: string, changes: Partial<Omit<FinanceGoalInput, 'kind'>>) =>
      run(() => updateFinanceGoal(id, changes)),
    removeGoal: (id: string) => run(() => deleteFinanceGoal(id)),
  };
}
