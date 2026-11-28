import { escapeCsvField } from './taskExportFormats';
import type { SecurityLog } from '../types/models';

// Colunas do CSV de logs de seguranca (admin), por ordem. O cabecalho vem de
// quem chama: ux4admin.logs.col.<chave>.
export const SECURITY_LOGS_CSV_COLUMNS = [
  'date',
  'ip',
  'method',
  'path',
  'type',
  'count',
  'user',
  'userAgent',
] as const;

export function securityLogsToCsv(logs: readonly SecurityLog[], headers: readonly string[]): string {
  const lines = [headers.map(escapeCsvField).join(',')];
  for (const log of logs) {
    const cells = [
      log.createdAt,
      log.ip,
      log.method,
      log.path,
      log.type,
      String(log.count),
      log.user ? (log.user.name || log.user.email) : '',
      log.userAgent ?? '',
    ];
    lines.push(cells.map(escapeCsvField).join(','));
  }
  return lines.join('\r\n');
}
