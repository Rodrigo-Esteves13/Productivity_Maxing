import { describe, expect, it, vi } from 'vitest';
import type { SecurityLogsQuery } from '../api/securityLogsService';
import type { SecurityLog } from '../types/models';
import {
  SECURITY_LOGS_EXPORT_MAX_ROWS,
  SECURITY_LOGS_EXPORT_PAGE_SIZE,
  fetchSecurityLogsForExport,
} from './securityLogsExport';

const server = (total: number) =>
  vi.fn(async ({ skip = 0, take = 0 }: SecurityLogsQuery) => ({
    total,
    skip,
    take,
    logs: Array.from(
      { length: Math.max(0, Math.min(take, total - skip)) },
      (_, i) => ({ id: String(skip + i) }) as SecurityLog,
    ),
  }));

describe('fetchSecurityLogsForExport', () => {
  it('reads every page keeping filters and order', async () => {
    const fetchPage = server(SECURITY_LOGS_EXPORT_PAGE_SIZE + 5);
    const result = await fetchSecurityLogsForExport(fetchPage, { ip: '1.1.1.1', sortBy: 'ip' });
    expect(result.logs).toHaveLength(SECURITY_LOGS_EXPORT_PAGE_SIZE + 5);
    expect(result.isCapped).toBe(false);
    expect(fetchPage).toHaveBeenCalledTimes(2);
    expect(fetchPage.mock.calls[1][0]).toMatchObject({
      ip: '1.1.1.1',
      sortBy: 'ip',
      skip: SECURITY_LOGS_EXPORT_PAGE_SIZE,
    });
  });

  it('stops at the cap and says so', async () => {
    const result = await fetchSecurityLogsForExport(server(SECURITY_LOGS_EXPORT_MAX_ROWS + 1), {});
    expect(result.logs).toHaveLength(SECURITY_LOGS_EXPORT_MAX_ROWS);
    expect(result.isCapped).toBe(true);
  });
});
