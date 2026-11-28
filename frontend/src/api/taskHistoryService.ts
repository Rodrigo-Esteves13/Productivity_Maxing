import api from './client';
import type { TaskChange } from '../lib/taskHistory';

// Historico de alteracoes de uma task, pela ordem que o backend devolve.
export const getTaskChanges = async (taskId: string, signal?: AbortSignal): Promise<TaskChange[]> =>
  (await api.get<TaskChange[]>(`/tasks/${encodeURIComponent(taskId)}/changes`, { signal })).data;
