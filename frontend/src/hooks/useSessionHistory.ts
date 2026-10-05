import { useCallback, useEffect, useState } from 'react';
import { getSessionHistory } from '../api/studySessionsService';
import type { StudySession } from '../types/models';

// Sessoes terminadas dos ultimos `days` dias. `refreshKey` volta a buscar
// quando muda (ex: o id da sessao ativa, para a lista atualizar ao parar).
export function useSessionHistory(days: number, refreshKey?: string | null) {
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  const reload = useCallback(async () => {
    try {
      setSessions(await getSessionHistory(days));
      setError(false);
    } catch {
      setError(true);
    } finally {
      setIsLoading(false);
    }
  }, [days]);

  useEffect(() => {
    void reload();
  }, [reload, refreshKey]);

  return { sessions, isLoading, error, reload };
}
