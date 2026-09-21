// src/api/bannedIpsService.ts
import api from './client';
import type { BannedIp } from '../types/models';

export const getBannedIps = async (): Promise<BannedIp[]> => {
  const response = await api.get<BannedIp[]>('/admin/banned-ips');
  return response.data;
};

export const banIp = async (ip: string, reason?: string): Promise<BannedIp> => {
  const response = await api.post<BannedIp>('/admin/banned-ips', { ip, reason });
  return response.data;
};

export const unbanIp = async (id: string): Promise<{ unbanned: string }> => {
  const response = await api.delete<{ unbanned: string }>(`/admin/banned-ips/${id}`);
  return response.data;
};
