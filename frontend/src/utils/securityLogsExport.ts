import type { SecurityLogsQuery } from '../api/securityLogsService';
import type { PaginatedSecurityLogs, SecurityLog } from '../types/models';

// Maximo que o servidor aceita por pedido (PaginationDto).
export const SECURITY_LOGS_EXPORT_PAGE_SIZE = 100;
// Teto do CSV: 50 pedidos, abaixo do limite global de 100 por minuto.
export const SECURITY_LOGS_EXPORT_MAX_ROWS = 5000;

export interface SecurityLogsExport {
  logs: SecurityLog[];
  // Total no servidor com estes filtros.
  total: number;
  isCapped: boolean;
}

// Todas as paginas que correspondem aos filtros e a ordem pedidos, ate ao
// teto. Linhas novas entre pedidos empurram as outras: repetidas saem por id.
export async function fetchSecurityLogsForExport(
  fetchPage: (query: SecurityLogsQuery) => Promise<PaginatedSecurityLogs>,
  query: SecurityLogsQuery,
): Promise<SecurityLogsExport> {
  const byId = new Map<string, SecurityLog>();
  let total = 0;
  for (let skip = 0; skip < SECURITY_LOGS_EXPORT_MAX_ROWS; skip += SECURITY_LOGS_EXPORT_PAGE_SIZE) {
    const page = await fetchPage({ ...query, skip, take: SECURITY_LOGS_EXPORT_PAGE_SIZE });
    total = page.total;
    for (const log of page.logs) byId.set(log.id, log);
    if (page.logs.length < SECURITY_LOGS_EXPORT_PAGE_SIZE || skip + page.logs.length >= total) break;
  }
  return {
    logs: [...byId.values()].slice(0, SECURITY_LOGS_EXPORT_MAX_ROWS),
    total,
    isCapped: total > SECURITY_LOGS_EXPORT_MAX_ROWS,
  };
}
