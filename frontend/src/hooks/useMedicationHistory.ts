import { useCallback, useState } from 'react';
import { getMedicationHistory } from '../api/wellbeingService';
import { toDateKey } from '../lib/dateKey';
import { MS_PER_DAY } from '../lib/timeConstants';
import { useLisbonToday } from './useLisbonToday';
import { useLoadOnce } from './useLoadOnce';

export type HistoryRange = 'week' | 'month' | 'quarter';

// Dias de cada vista, a acabar hoje (o backend aceita ate 92).
export const HISTORY_RANGE_DAYS: Record<HistoryRange, number> = {
  week: 7,
  month: 30,
  quarter: 90,
};

// Historico de adesao da medicacao para a vista escolhida.
export function useMedicationHistory() {
  const today = useLisbonToday();
  const [range, setRange] = useState<HistoryRange>('week');
  const fetcher = useCallback(() => {
    const from = toDateKey(new Date(Date.parse(today) - (HISTORY_RANGE_DAYS[range] - 1) * MS_PER_DAY));
    return getMedicationHistory(from, today);
  }, [range, today]);
  const { data, isLoading, error } = useLoadOnce(fetcher, `${range}:${today}`);
  return { history: data, isLoading, error, range, setRange };
}
