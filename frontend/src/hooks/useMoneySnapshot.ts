import { useEffect, useState } from 'react';
import { getFinance, type FinanceOccurrence, type FinanceSummary } from '../api/financeService';
import { todayKey } from '../lib/dateKey';
import { mergeRenewalOccurrences, renewalSpilloverMonth } from '../lib/moneySnapshot';

interface MoneySnapshotState {
  data: FinanceSummary | null;
  /** Ocorrencias para a proxima renovacao: mes atual + o seguinte quando a janela o cruza. */
  renewalOccurrences: FinanceOccurrence[];
  isLoading: boolean;
  hasError: boolean;
}

const EMPTY: FinanceOccurrence[] = [];

// Um pedido do mes atual ao montar e, so quando hoje + janela de renovacoes
// passa para o mes seguinte, um segundo pedido desse mes (no maximo um extra).
// Falhar o extra nao esconde o cartao. Sem refetch; ignora a resposta se o
// cartao ja saiu do ecra.
export function useMoneySnapshot(): MoneySnapshotState {
  const [state, setState] = useState<MoneySnapshotState>({ data: null, renewalOccurrences: EMPTY, isLoading: true, hasError: false });

  useEffect(() => {
    let active = true;
    const today = todayKey();
    const spillover = renewalSpilloverMonth(today);
    Promise.all([
      getFinance(today.slice(0, 7)),
      spillover ? getFinance(spillover).catch(() => null) : Promise.resolve(null),
    ])
      .then(([data, next]) => {
        if (!active) return;
        const renewalOccurrences = mergeRenewalOccurrences(data.occurrences, next?.occurrences ?? null);
        setState({ data, renewalOccurrences, isLoading: false, hasError: false });
      })
      .catch(() => {
        if (active) setState({ data: null, renewalOccurrences: EMPTY, isLoading: false, hasError: true });
      });
    return () => {
      active = false;
    };
  }, []);

  return state;
}
