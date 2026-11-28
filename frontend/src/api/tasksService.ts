// src/api/tasksService.ts
import api from './client';
import { fetchAllPages } from './fetchAllPages';
import { cachedQuery } from './queryCache';
import {
  forgetKnownTasks,
  forgetTasks,
  rememberStatus,
  rememberTasks,
  tasksKey,
  tasksQuery,
} from './catalogCache';
import { notifyDomainChanged } from '../lib/domainEvents';
import type {
  ImportTaskRow,
  ImportTasksResult,
  RestoreTaskInput,
  RestoreTasksResult,
  Task,
  TaskWriteInput,
  WeeklyReview,
} from '../types/models';

// TASK ENDPOINTS
// periodId: omitido = período ativo do user (default no backend); 'all' =
// todos os períodos agregados ("Ver todos os períodos" no seletor); um
// UUID = esse período específico.
// Com cache por periodo e stale-while-revalidate (F-16, F-48, ver
// catalogCache.ts). `signal` cancela so a espera deste chamador.
export const getUserTasks = async (periodId?: string, signal?: AbortSignal): Promise<Task[]> => {
  // Segue as paginas de cursor em vez do modo array, que corta em 1000.
  return cachedQuery(
    tasksKey(periodId),
    (shared) => fetchAllPages<Task>('/tasks', periodId ? { periodId } : {}, shared),
    tasksQuery(periodId),
    { signal },
  );
};

// Escritas que corrigem o "ultimo conhecido" das tasks (conquistas, F-18)
// em vez de o deitar fora. A cache normal e invalidada na mesma.
const PATCHED = { cacheEffect: 'patched' } as const;

export async function createTask(taskData: TaskWriteInput): Promise<Task> {
  const response = await api.post<Task>('/tasks', taskData, PATCHED);
  // Noutro periodo que nao o ativo: nao se sabe se entra na lista.
  if (taskData.periodId) forgetKnownTasks();
  else rememberTasks([response.data]);
  // Cartoes que buscam por conta propria (Dashboard, Focus) voltam a ler.
  notifyDomainChanged('tasks');
  return response.data;
}

export async function getTaskById(id: string): Promise<Task> {
  const response = await api.get<Task>(`/tasks/${id}`);
  return response.data;
}

export async function updateTask(id: string, taskData: TaskWriteInput): Promise<Task> {
  const response = await api.patch<Task>(`/tasks/${id}`, taskData, PATCHED);
  if (taskData.periodId !== undefined) forgetKnownTasks();
  else {
    const { spawnedTasks = [], ...updated } = response.data;
    rememberTasks([updated as Task, ...spawnedTasks]);
  }
  notifyDomainChanged('tasks');
  return response.data;
}

export async function deleteTask(id: string): Promise<void> {
  await api.delete(`/tasks/${id}`, PATCHED);
  forgetTasks([id]);
  notifyDomainChanged('tasks');
}

// Drag-and-drop no TaskGrid - taskIds é a sequência completa tal como
// deve passar a aparecer; o backend converte o índice de cada uma em
// sortOrder (ver TasksService.reorder).
export async function reorderTasks(taskIds: string[]): Promise<void> {
  await api.patch('/tasks/reorder', { taskIds });
}

// BULK ACTIONS (multi-select on the Dashboard table)
// O backend aceita no maximo 200 ids por pedido (@ArrayMaxSize nos DTOs de
// bulk). "Selecionar tudo" numa tabela maior falhava sempre, por isso as
// listas vao em lotes sequenciais e as contagens somam-se.
// Espelha TASK_BULK_MAX (backend/src/tasks/tasks.constants.ts); o teste
// bulkBatches.test.ts falha se os dois divergirem.
export const BULK_TASK_BATCH_SIZE = 200;

export function chunkIds(ids: string[], size = BULK_TASK_BATCH_SIZE): string[][] {
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += size) chunks.push(ids.slice(i, i + size));
  return chunks;
}

async function inBatches(
  ids: string[],
  send: (batch: string[]) => Promise<{ count: number }>,
  remember?: (batch: string[]) => void,
): Promise<{ count: number }> {
  let count = 0;
  try {
    for (const batch of chunkIds(ids)) {
      count += (await send(batch)).count;
      remember?.(batch);
    }
  } finally {
    // Mesmo com um lote falhado, os anteriores ja gravaram.
    if (count > 0) notifyDomainChanged('tasks');
  }
  return { count };
}

export async function bulkUpdateTaskStatus(
  ids: string[],
  progressStatus: Task['progressStatus'],
): Promise<{ count: number }> {
  return inBatches(
    ids,
    async (batch) => {
      const response = await api.patch<{ count: number }>(
        '/tasks/bulk-status',
        { ids: batch, progressStatus },
        PATCHED,
      );
      return response.data;
    },
    (batch) => rememberStatus(batch, progressStatus, new Date().toISOString()),
  );
}

export async function bulkSetTaskEffort(
  ids: string[],
  effort: Task['effort'],
): Promise<{ count: number }> {
  return inBatches(ids, async (batch) => {
    const response = await api.patch<{ count: number }>('/tasks/bulk-effort', { ids: batch, effort });
    return response.data;
  });
}

// "Mover para" da selecao: date em ISO (meia-noite UTC do dia escolhido).
// Tasks ja concluidas ficam onde estao (ver bulk-reschedule.util.ts).
export async function bulkRescheduleTasks(ids: string[], date: string): Promise<{ count: number }> {
  return inBatches(ids, async (batch) => {
    const response = await api.patch<{ count: number }>('/tasks/bulk-reschedule', { ids: batch, date });
    return response.data;
  });
}

export async function bulkDeleteTasks(ids: string[]): Promise<{ count: number }> {
  return inBatches(
    ids,
    async (batch) => {
      const response = await api.post<{ count: number }>('/tasks/bulk-delete', { ids: batch }, PATCHED);
      return response.data;
    },
    forgetTasks,
  );
}

// "Anular" do apagar em massa: um lote por pedido (ver lib/restoreTask.ts).
export async function restoreTasksBatch(tasks: RestoreTaskInput[]): Promise<RestoreTasksResult> {
  const response = await api.post<RestoreTasksResult>('/tasks/bulk-restore', { tasks });
  notifyDomainChanged('tasks');
  return response.data;
}

// Excel/CSV import - see hooks/useTaskImport.ts, which parses the file
// with SheetJS and maps its Area/Type NAME columns to the IDs/keys this
// endpoint expects before calling it.
export async function importTasks(rows: ImportTaskRow[]): Promise<ImportTasksResult> {
  const response = await api.post<ImportTasksResult>('/tasks/import', { tasks: rows });
  notifyDomainChanged('tasks');
  return response.data;
}

// OVERDUE CHECK-IN
// Tasks fora de prazo, ainda não marcadas como COMPLETED, que ainda não
// foram perguntadas hoje - alimenta o OverdueCheckinModal.
export const getOverdueCheckins = async (): Promise<Task[]> => {
  const response = await api.get<Task[]>('/tasks/overdue-checkins');
  return response.data;
};

// Regista a resposta do user a "esta task já está feita?" para uma task
// fora de prazo. isCompleted=true marca-a como COMPLETED de verdade;
// isCompleted=false só evita repetir a pergunta hoje (ou durante
// `snoozeDays`). `realGrade` so conta quando isCompleted=true.
export interface OverdueAnswer {
  isCompleted: boolean;
  realGrade?: number;
  snoozeDays?: number;
}

export const confirmOverdueTask = async (
  id: string,
  answer: OverdueAnswer,
): Promise<Task> => {
  const response = await api.patch<Task>(`/tasks/${id}/overdue-checkin`, answer, PATCHED);
  rememberTasks([response.data]);
  notifyDomainChanged('tasks');
  return response.data;
};

export const getWeeklyReview = async (): Promise<WeeklyReview> => {
  const response = await api.get<WeeklyReview>('/tasks/weekly-review');
  return response.data;
};
