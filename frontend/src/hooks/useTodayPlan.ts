import { useCallback, useEffect, useState } from 'react';
import { getTodayTasks } from '../api/studySessionsService';
import type { Task } from '../types/models';
import { translateNow } from '../i18n/translate';

export function useTodayPlan() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchTasks = useCallback(async () => {
    try {
      setIsLoading(true);
      setError('');
      const data = await getTodayTasks();
      setTasks(data);
    } catch {
      setError(translateNow('hook.couldNotLoadTodaysTasks'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchTasks();
  }, [fetchTasks]);

  return { tasks, isLoading, error, refetch: fetchTasks };
}
