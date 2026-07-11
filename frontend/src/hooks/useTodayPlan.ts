import { useCallback, useEffect, useState } from 'react';
import { getTodayTasks } from '../api/studySessionsService';
import type { Task } from '../types/models';

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
      setError('Could not load today\'s tasks.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchTasks();
  }, [fetchTasks]);

  return { tasks, isLoading, error, refetch: fetchTasks };
}
