// Maximo de dias aceite ao purgar logs (10 anos).
export const SECURITY_LOGS_PURGE_MAX_DAYS = 3650;

// Colunas por que GET /admin/security-logs aceita ordenar (lista fechada).
export const SECURITY_LOG_SORT_FIELDS = [
  'createdAt',
  'ip',
  'method',
  'path',
  'user',
] as const;
export type SecurityLogSortField = (typeof SECURITY_LOG_SORT_FIELDS)[number];
export const SECURITY_LOG_SORT_DIRECTIONS = ['asc', 'desc'] as const;
export type SecurityLogSortDirection =
  (typeof SECURITY_LOG_SORT_DIRECTIONS)[number];
