import { useEffect, useState } from 'react';
import { getUserTasks, getTaskMetadata } from '../api/userService';
import { computeProfileStats, extractProjectTypeKeys, type ProfileStats } from '../utils/profileStats';

export interface UseProfileStatsResult extends ProfileStats {
  isLoading: boolean;
}

export function useProfileStats(): UseProfileStatsResult {
  const [stats, setStats] = useState<ProfileStats>({ completed: 0, active: 0, projects: 0, streak: 0 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchStats() {
      try {
        const [tasks, metaData] = await Promise.all([getUserTasks(), getTaskMetadata()]);
        if (cancelled) return;
        const projectTypeKeys = extractProjectTypeKeys(metaData.taskTypes);
        setStats(computeProfileStats(tasks, projectTypeKeys));
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

  return { ...stats, isLoading };
}
