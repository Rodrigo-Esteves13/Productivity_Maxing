// src/api/metadataService.ts
import api from './client';
import { cachedQuery } from './queryCache';
import { META_KEY, META_QUERY } from './catalogCache';
import type { TaskMeta } from '../types/models';

// Catalogo de metadados das tasks (tipos, prioridades, estados).
export async function getTaskMetadata(): Promise<TaskMeta> {
  return cachedQuery(
    META_KEY,
    async (signal) => (await api.get<TaskMeta>('/tasks/meta', { signal })).data,
    META_QUERY,
  );
}
