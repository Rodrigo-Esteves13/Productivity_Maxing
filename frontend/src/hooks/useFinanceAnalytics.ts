import { useEffect, useState } from 'react';
import { getFinanceAnalytics, type AnalyticsGranularity, type FinanceAnalytics } from '../api/financeService';
import { monthsRange } from '../lib/money';

// Analitica por semana ou mes. `refreshKey` muda quando os dados do mes foram
// alterados, para os graficos acompanharem.
export function useFinanceAnalytics(granularity: AnalyticsGranularity, months: number, refreshKey: number) {
  const [data, setData] = useState<FinanceAnalytics | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const { from, to } = monthsRange(months);
    getFinanceAnalytics({ granularity, from, to })
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setError(false);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [granularity, months, refreshKey]);

  return { data, error };
}
