import { useCallback, useEffect, useRef, useState } from 'react';
import { getTodayTasks } from '../api/studySessionsService';
import type { Task } from '../types/models';
import { translateNow } from '../i18n/translate';

// `refreshKey` (opcional): quando muda, volta a pedir. Depois da primeira
// leitura os refetch sao silenciosos (a lista nao volta a desaparecer).
export function useTodayPlan(refreshKey?: string | null) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const hasLoadedRef = useRef(false);

  const fetchTasks = useCallback(async () => {
    try {
      if (!hasLoadedRef.current) setIsLoading(true);
      setError('');
      const data = await getTodayTasks();
      setTasks(data);
      hasLoadedRef.current = true;
    } catch {
      setError(translateNow('hook.couldNotLoadTodaysTasks'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchTasks();
  }, [fetchTasks, refreshKey]);

  return { tasks, isLoading, error, refetch: fetchTasks };
}
