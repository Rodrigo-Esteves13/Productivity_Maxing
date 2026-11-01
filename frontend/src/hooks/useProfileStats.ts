import { useEffect, useMemo, useState } from 'react';
import { getUserTasks, getTaskMetadata } from '../api/userService';
import { computeProfileStats, extractProjectTypeKeys, type ProfileStats } from '../utils/profileStats';
import { useStreakRestPref } from './useStreakRestPref';
import type { Task } from '../types/models';

export interface UseProfileStatsResult extends ProfileStats {
  isLoading: boolean;
}

export function useProfileStats(): UseProfileStatsResult {
  const [source, setSource] = useState<{ tasks: Task[]; projectTypeKeys: Set<string> }>({
    tasks: [],
    projectTypeKeys: new Set(),
  });
  const [isLoading, setIsLoading] = useState(true);
  const { mode } = useStreakRestPref();

  useEffect(() => {
    let cancelled = false;

    async function fetchStats() {
      try {
        const [tasks, metaData] = await Promise.all([getUserTasks(), getTaskMetadata()]);
        if (cancelled) return;
        setSource({ tasks, projectTypeKeys: extractProjectTypeKeys(metaData.taskTypes) });
      } catch (err) {
        console.error('Failed to fetch profile stats:', err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    fetchStats();
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = useMemo(
    () => computeProfileStats(source.tasks, source.projectTypeKeys, mode),
    [source, mode]
  );

  return { ...stats, isLoading };
}
