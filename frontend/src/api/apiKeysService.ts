// src/api/apiKeysService.ts
import api from './client';
import type { ApiKeySummary, ApiKeyScope } from '../types/models';

// API KEYS (Developer page)
export const getApiKeys = async (): Promise<ApiKeySummary[]> => {
  const response = await api.get<ApiKeySummary[]>('/auth/api-keys');
  return response.data;
};

// A resposta traz a raw key em texto - é a ÚNICA vez que ela existe em
// texto simples, o backend só guarda o hash. Mostra-a uma vez ao user e
// depois esquece.
// scope defaults to 'TASKS' - the backend refuses an 'ADMIN' request from
// anyone whose own Role isn't already ADMIN (see AuthService.generateApiKey),
// this is just what gets sent, not what's actually granted.
export const createApiKey = async (
  name: string,
  scope: ApiKeyScope = 'TASKS',
): Promise<{ apiKey: string }> => {
  const response = await api.post<{ apiKey: string }>('/auth/api-keys', { name, scope });
  return response.data;
};

export const renameApiKey = async (id: string, name: string): Promise<void> => {
  await api.patch(`/auth/api-keys/${encodeURIComponent(id)}`, { name });
};

export const revokeApiKey = async (id: string): Promise<void> => {
  await api.delete(`/auth/api-keys/${id}`);
};
