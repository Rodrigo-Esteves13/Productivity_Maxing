import type { SecurityLog } from '../types/models';

// Ordenacao local da pagina de logs que ja esta carregada (o servidor
// devolve sempre do mais recente para o mais antigo).
export type SecurityLogSortKey = 'createdAt' | 'ip' | 'method' | 'path' | 'user';
export type SortDirection = 'asc' | 'desc';

export interface SecurityLogSort {
  key: SecurityLogSortKey;
  direction: SortDirection;
}

export const DEFAULT_SECURITY_LOG_SORT: SecurityLogSort = { key: 'createdAt', direction: 'desc' };

const SORT_VALUE: Record<SecurityLogSortKey, (log: SecurityLog) => string> = {
  createdAt: (log) => log.createdAt,
  ip: (log) => log.ip,
  method: (log) => log.method,
  path: (log) => log.path,
  user: (log) => (log.user ? (log.user.name || log.user.email) : ''),
};

export function sortSecurityLogs(logs: readonly SecurityLog[], sort: SecurityLogSort): SecurityLog[] {
  const read = SORT_VALUE[sort.key];
  const sign = sort.direction === 'asc' ? 1 : -1;
  return [...logs].sort(
    (a, b) => sign * read(a).localeCompare(read(b), undefined, { numeric: true, sensitivity: 'base' }),
  );
}

// Clicar na coluna ativa inverte; noutra coluna comeca em ascendente
// (a data comeca em descendente: o mais recente primeiro).
export function nextSecurityLogSort(current: SecurityLogSort, key: SecurityLogSortKey): SecurityLogSort {
  if (current.key === key) return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
  return { key, direction: key === 'createdAt' ? 'desc' : 'asc' };
}
