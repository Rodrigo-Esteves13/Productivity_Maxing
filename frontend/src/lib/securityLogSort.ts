import type { SortDirection } from './sortDirection';

// Ordem pedida ao servidor (GET /admin/security-logs?sortBy&sortDir). As
// chaves tem de acompanhar SECURITY_LOG_SORT_FIELDS do backend.
export type SecurityLogSortKey = 'createdAt' | 'ip' | 'method' | 'path' | 'user';

export interface SecurityLogSort {
  key: SecurityLogSortKey;
  direction: SortDirection;
}

export const DEFAULT_SECURITY_LOG_SORT: SecurityLogSort = { key: 'createdAt', direction: 'desc' };

// Clicar na coluna ativa inverte; noutra coluna comeca em ascendente
// (a data comeca em descendente: o mais recente primeiro).
export function nextSecurityLogSort(current: SecurityLogSort, key: SecurityLogSortKey): SecurityLogSort {
  if (current.key === key) return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
  return { key, direction: key === 'createdAt' ? 'desc' : 'asc' };
}
