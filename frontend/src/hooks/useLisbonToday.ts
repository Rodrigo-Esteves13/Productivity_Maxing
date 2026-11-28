import { useCallback, useEffect, useState } from 'react';
import { lisbonTodayKey } from '../lib/dateKey';
import { MS_PER_MINUTE } from '../lib/timeConstants';
import { useVisibleInterval } from './useVisibleInterval';

// De quanto em quanto tempo (com o separador visivel) se confirma se o dia
// de Lisboa ja mudou. Um minuto chega: a meia-noite nao precisa de ser ao
// segundo, e o pedido so e refeito quando a chave muda mesmo.
const DAY_CHECK_INTERVAL_MS = MS_PER_MINUTE;

/**
 * Chave "YYYY-MM-DD" do dia de hoje em Lisboa (o dia que o backend usa para
 * medicacao e humor), sempre atual. Antes os hooks liam o dia uma vez ao
 * montar: uma PWA reaberta no dia seguinte mostrava os vistos de ontem como
 * se fossem de hoje e gravava as tomas novas em ontem (D-05). Volta a ler ao
 * voltar ao separador, ao ganhar foco e a cada minuto enquanto visivel.
 */
export function useLisbonToday(): string {
  const [today, setToday] = useState(lisbonTodayKey);

  // setState com o mesmo valor nao volta a renderizar.
  const check = useCallback(() => setToday(lisbonTodayKey()), []);
  useVisibleInterval(check, DAY_CHECK_INTERVAL_MS);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible') check();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', check);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', check);
    };
  }, [check]);

  return today;
}
