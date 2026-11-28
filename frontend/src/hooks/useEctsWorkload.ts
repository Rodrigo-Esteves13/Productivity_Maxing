import { useCallback, useEffect, useState } from 'react';
import { getEctsWorkload } from '../api/scheduleService';
import { useAcademic } from '../context/useAcademic';
import { isRequestCanceled } from '../lib/abortable';
import type { EctsWorkload } from '../types/models';
import { useActivePeriodRange } from './useActivePeriodRange';
import { useStudyDataKey } from './useSessionEndKey';

interface EctsWorkloadState {
  data: EctsWorkload | null;
  isLoading: boolean;
  hasError: boolean;
}

interface KeyedState extends EctsWorkloadState {
  // Pedido a que este estado responde; estado de outro pedido e ignorado.
  key: string;
}

const LOADING_STATE: EctsWorkloadState = { data: null, isLoading: true, hasError: false };

// Horas reais (aulas + estudo) por cadeira no periodo ativo. retry volta a pedir.
// Ao mudar de periodo/intervalo o estado antigo nunca e devolvido: volta a "loading".
// Uma sessao de estudo terminada, criada, corrigida ou apagada refaz o pedido em
// silencio (os dados mostrados ficam ate chegar a resposta, ou se ela falhar).
export function useEctsWorkload(): EctsWorkloadState & { retry: () => void } {
  const { from, to } = useActivePeriodRange();
  const { activePeriod } = useAcademic();
  const periodId = activePeriod?.id;
  const key = `${from}|${to}|${periodId ?? ''}`;
  const [reloadKey, setReloadKey] = useState(0);
  const dataKey = useStudyDataKey();
  const [state, setState] = useState<KeyedState>({ ...LOADING_STATE, key });

  useEffect(() => {
    const controller = new AbortController();
    getEctsWorkload(from, to, periodId, controller.signal)
      .then((data) => setState({ key, data, isLoading: false, hasError: false }))
      .catch((caught: unknown) => {
        if (isRequestCanceled(caught)) return;
        setState((prev) =>
          prev.key === key && prev.data
            ? { ...prev, isLoading: false, hasError: false }
            : { key, data: null, isLoading: false, hasError: true },
        );
      });
    return () => controller.abort();
  }, [from, to, periodId, key, reloadKey, dataKey]);

  const retry = useCallback(() => {
    setState((prev) => ({ ...prev, isLoading: true, hasError: false }));
    setReloadKey((n) => n + 1);
  }, []);

  if (state.key !== key) return { ...LOADING_STATE, retry };
  const { data, isLoading, hasError } = state;
  return { data, isLoading, hasError, retry };
}
