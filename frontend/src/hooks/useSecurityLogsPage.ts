import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getSecurityLogs,
  getSecurityLogsStats,
  purgeSecurityLogs,
  type SecurityLogsQuery,
} from '../api/securityLogsService';
import {
  DEFAULT_SECURITY_LOG_SORT,
  nextSecurityLogSort,
  type SecurityLogSortKey,
} from '../lib/securityLogSort';
import { securityLogsToCsv, SECURITY_LOGS_CSV_COLUMNS } from '../utils/securityLogsCsv';
import { fetchSecurityLogsForExport } from '../utils/securityLogsExport';
import { downloadTextFile } from '../utils/downloadTextFile';
import { todayKey } from '../lib/dateKey';
import type { SecurityLog, SecurityLogsStats } from '../types/models';
import { useFeedback } from '../context/useFeedback';
import { translateNow } from '../i18n/translate';

const PAGE_SIZE = 25;
// Espera antes de pedir ao servidor depois de escrever num filtro.
const FILTER_DEBOUNCE_MS = 300;
const CSV_MIME_TYPE = 'text/csv;charset=utf-8';
const CSV_FILE_PREFIX = 'pmaxing_security_logs_';

export interface SecurityLogsFiltersState {
  ip: string;
  path: string;
  window: '' | '1h' | '24h' | '7d';
}

const emptyFilters: SecurityLogsFiltersState = { ip: '', path: '', window: '' };

export function useSecurityLogsPage() {
  const { notify, confirm } = useFeedback();
  const [logs, setLogs] = useState<SecurityLog[]>([]);
  const [total, setTotal] = useState(0);
  const [skip, setSkip] = useState(0);
  const [stats, setStats] = useState<SecurityLogsStats | null>(null);

  const [filters, setFilters] = useState<SecurityLogsFiltersState>(emptyFilters);
  // Os filtros que realmente vao ao servidor (os de cima seguem cada tecla).
  const [appliedFilters, setAppliedFilters] = useState<SecurityLogsFiltersState>(emptyFilters);
  const latestRequest = useRef(0);
  const [sort, setSort] = useState(DEFAULT_SECURITY_LOG_SORT);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setAppliedFilters(filters), FILTER_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [filters]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isPurging, setIsPurging] = useState(false);

  const buildQuery = useCallback(
    (skipOverride: number): SecurityLogsQuery => ({
      skip: skipOverride,
      take: PAGE_SIZE,
      ...(appliedFilters.ip.trim() ? { ip: appliedFilters.ip.trim() } : {}),
      ...(appliedFilters.path.trim() ? { path: appliedFilters.path.trim() } : {}),
      ...(appliedFilters.window ? { window: appliedFilters.window } : {}),
      sortBy: sort.key,
      sortDir: sort.direction,
    }),
    [appliedFilters, sort],
  );

  const fetchLogs = useCallback(
    async (skipOverride = 0) => {
      // Respostas fora de ordem: so a do pedido mais recente conta.
      const requestId = ++latestRequest.current;
      try {
        setIsLoading(true);
        setError('');
        const data = await getSecurityLogs(buildQuery(skipOverride));
        if (requestId !== latestRequest.current) return;
        setLogs(data.logs);
        setTotal(data.total);
        setSkip(data.skip);
      } catch {
        if (requestId === latestRequest.current) setError(translateNow('hook.errorLoadingSecurityLogs'));
      } finally {
        if (requestId === latestRequest.current) setIsLoading(false);
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

  // Sempre que os filtros ou a ordem mudam, volta à primeira página.
  useEffect(() => {
    fetchLogs(0);
  }, [fetchLogs]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const clearFilters = () => setFilters(emptyFilters);

  // Volta a pedir a pagina atual e os totais (sem saltar para a primeira).
  const refresh = useCallback(() => {
    void Promise.all([fetchLogs(skip), fetchStats()]);
  }, [fetchLogs, fetchStats, skip]);

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
      ? translateNow('hook.deleteLogsOlderThan', { days: olderThanDays })
      : translateNow('hook.deleteAllSecurityLogsThisCannot');
    const confirmed = await confirm({
      title: translateNow('hook.clearSecurityLogs'),
      message,
      confirmLabel: translateNow('hook.delete'),
      tone: 'danger',
    });
    if (!confirmed) return;

    setIsPurging(true);
    try {
      await purgeSecurityLogs(olderThanDays);
      await Promise.all([fetchLogs(0), fetchStats()]);
    } catch {
      notify(translateNow('hook.errorClearingLogsCheckTheBackend'), 'error');
    } finally {
      setIsPurging(false);
    }
  };

  const toggleSort = (key: SecurityLogSortKey) => setSort((prev) => nextSecurityLogSort(prev, key));

  // CSV de todos os resultados dos filtros (nao so da pagina), ate ao teto.
  // Os cabecalhos vem de quem chama, ja traduzidos.
  const exportCsv = async () => {
    setIsExporting(true);
    try {
      const result = await fetchSecurityLogsForExport(getSecurityLogs, buildQuery(0));
      const headers = SECURITY_LOGS_CSV_COLUMNS.map((column) => translateNow(`ux4admin.logs.col.${column}`));
      downloadTextFile(securityLogsToCsv(result.logs, headers), `${CSV_FILE_PREFIX}${todayKey()}.csv`, CSV_MIME_TYPE);
      const count = result.logs.length;
      if (result.isCapped) {
        notify(translateNow('f7admin.logs.exportCapped', { count, total: result.total }), 'info');
      } else {
        notify(translateNow('ux4admin.logs.exported', { count }), 'success');
      }
    } catch {
      notify(translateNow('f7admin.logs.exportError'), 'error');
    } finally {
      setIsExporting(false);
    }
  };

  return {
    sort,
    toggleSort,
    exportCsv,
    isExporting,
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
    refresh,
  };
}
