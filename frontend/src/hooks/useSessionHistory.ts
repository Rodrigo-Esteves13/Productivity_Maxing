import { useCallback } from 'react';
import { getSessionHistory } from '../api/studySessionsService';
import type { StudySession } from '../types/models';
import { useFetch } from './useFetch';

const NO_SESSIONS: StudySession[] = [];

// Sessoes terminadas dos ultimos `days` dias. `refreshKey` volta a buscar
// quando muda (ex: o id da sessao ativa, para a lista atualizar ao parar).
// Mudar `days` ou `refreshKey` cancela o pedido anterior. `reload`: para
// recarregar depois de editar/apagar.
export function useSessionHistory(days: number, refreshKey?: string | null) {
  const fetcher = useCallback((signal: AbortSignal) => getSessionHistory(days, signal), [days]);
  const { data, isLoading, hasError, reload } = useFetch(fetcher, { refreshKey });

  return { sessions: data ?? NO_SESSIONS, isLoading, error: hasError, reload };
}
