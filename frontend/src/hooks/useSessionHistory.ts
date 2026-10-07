import { useCallback, useEffect, useState } from 'react';
import { getSessionHistory } from '../api/studySessionsService';
import { isRequestCanceled } from '../lib/abortable';
import type { StudySession } from '../types/models';

// Sessoes terminadas dos ultimos `days` dias. `refreshKey` volta a buscar
// quando muda (ex: o id da sessao ativa, para a lista atualizar ao parar).
// Mudar `days` ou `refreshKey` cancela o pedido anterior.
export function useSessionHistory(days: number, refreshKey?: string | null) {
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const result = await getSessionHistory(days, signal);
        setSessions(result);
        setError(false);
        setIsLoading(false);
      } catch (caught) {
        if (isRequestCanceled(caught)) return;
        setError(true);
        setIsLoading(false);
      }
    },
    [days],
  );

  // Para recarregar depois de editar/apagar (sem sinal: nao se cancela).
  const reload = useCallback(() => load(), [load]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load, refreshKey]);

  return { sessions, isLoading, error, reload };
}
