import { useCallback, useEffect, useState } from 'react';
import {
  getSecurityLogs,
  getSecurityLogsStats,
  purgeSecurityLogs,
  type SecurityLogsQuery,
} from '../api/securityLogsService';
import type { SecurityLog, SecurityLogsStats } from '../types/models';

const PAGE_SIZE = 25;

export interface SecurityLogsFiltersState {
  ip: string;
  path: string;
  window: '' | '1h' | '24h' | '7d';
}

const emptyFilters: SecurityLogsFiltersState = { ip: '', path: '', window: '' };

export function useSecurityLogsPage() {
  const [logs, setLogs] = useState<SecurityLog[]>([]);
  const [total, setTotal] = useState(0);
  const [skip, setSkip] = useState(0);
  const [stats, setStats] = useState<SecurityLogsStats | null>(null);

  const [filters, setFilters] = useState<SecurityLogsFiltersState>(emptyFilters);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isPurging, setIsPurging] = useState(false);

  const buildQuery = useCallback(
    (skipOverride: number): SecurityLogsQuery => ({
      skip: skipOverride,
      take: PAGE_SIZE,
      ...(filters.ip.trim() ? { ip: filters.ip.trim() } : {}),
      ...(filters.path.trim() ? { path: filters.path.trim() } : {}),
      ...(filters.window ? { window: filters.window } : {}),
    }),
    [filters],
  );

  const fetchLogs = useCallback(
    async (skipOverride = 0) => {
      try {
        setIsLoading(true);
        setError('');
        const data = await getSecurityLogs(buildQuery(skipOverride));
        setLogs(data.logs);
        setTotal(data.total);
        setSkip(data.skip);
      } catch {
        setError('Error loading security logs.');
      } finally {
        setIsLoading(false);
      }
    },
    [buildQuery],
  );

  const fetchStats = useCallback(async () => {
    try {
      const data = await getSecurityLogsStats();
      setStats(data);
    } catch {
      // Os stats são só um resumo no topo - se falharem, a tabela em baixo
      // continua a funcionar normalmente, não vale a pena bloquear a página.
    }
  }, []);

  // Sempre que os filtros mudam, volta à primeira página.
  useEffect(() => {
    fetchLogs(0);
  }, [fetchLogs]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const clearFilters = () => setFilters(emptyFilters);

  const goToNextPage = () => {
    if (skip + PAGE_SIZE >= total) return;
    fetchLogs(skip + PAGE_SIZE);
  };

  const goToPrevPage = () => {
    if (skip === 0) return;
    fetchLogs(Math.max(0, skip - PAGE_SIZE));
  };

  const handlePurge = async (olderThanDays?: number) => {
    const message = olderThanDays
      ? `Delete all security logs older than ${olderThanDays} days?`
      : 'Delete ALL security logs? This cannot be undone.';
    const confirmed = window.confirm(message);
    if (!confirmed) return;

    setIsPurging(true);
    try {
      await purgeSecurityLogs(olderThanDays);
      await Promise.all([fetchLogs(0), fetchStats()]);
    } catch {
      alert('Error clearing logs. Check the backend.');
    } finally {
      setIsPurging(false);
    }
  };

  return {
    logs,
    total,
    skip,
    pageSize: PAGE_SIZE,
    stats,
    filters,
    setFilters,
    clearFilters,
    isLoading,
    error,
    isPurging,
    goToNextPage,
    goToPrevPage,
    handlePurge,
  };
}
