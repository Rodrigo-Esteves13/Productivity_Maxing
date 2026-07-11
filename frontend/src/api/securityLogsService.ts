// src/api/securityLogsService.ts
import api from './client';
import type { PaginatedSecurityLogs, SecurityLogsStats } from '../types/models';

export interface SecurityLogsQuery {
  skip?: number;
  take?: number;
  ip?: string;
  path?: string;
  window?: '1h' | '24h' | '7d';
}

// ADMIN endpoints (todos exigem role ADMIN no backend, ver
// security-logs.controller.ts).

export const getSecurityLogs = async (
  query: SecurityLogsQuery = {},
): Promise<PaginatedSecurityLogs> => {
  const response = await api.get<PaginatedSecurityLogs>('/admin/security-logs', {
    params: query,
  });
  return response.data;
};

export const getSecurityLogsStats = async (): Promise<SecurityLogsStats> => {
  const response = await api.get<SecurityLogsStats>('/admin/security-logs/stats');
  return response.data;
};

// olderThanDays omitido -> apaga TODOS os logs. Usado pelo botão "Clear
// all" / "Clear old logs" na página de admin.
export const purgeSecurityLogs = async (
  olderThanDays?: number,
): Promise<{ deleted: number }> => {
  const response = await api.delete<{ deleted: number }>('/admin/security-logs', {
    params: olderThanDays ? { olderThanDays } : undefined,
  });
  return response.data;
};
