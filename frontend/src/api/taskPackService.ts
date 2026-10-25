import type { DateCertainty, Effort } from '../types/models';
import api from './client';

export interface TaskPackSummary {
  id: string;
  name: string;
  code: string;
  itemCount: number;
  importCount: number;
  createdAt: string;
}

export interface TaskPackPreviewItem {
  id: string;
  title: string;
  date: string;
  weightPercentage: number | null;
  areaName: string;
  /** Cadeira oficial fixa (igual para todos); null = escolhes a tua. */
  fixedAreaId: string | null;
  suggestedAreaId: string | null;
  taskType: string;
  effort: Effort | null;
  dateCertainty: DateCertainty;
  /** Dia em que a task abre (ainda nao da para comecar); null = ja aberta. */
  availableFrom: string | null;
  isBlocked: boolean;
  alreadyHave: boolean;
}

export interface TaskPackPreview {
  name: string;
  ownerName: string;
  items: TaskPackPreviewItem[];
}

export interface ImportItemResult {
  itemId: string;
  ok: boolean;
  error?: string;
}

export interface ImportTaskPackResult {
  created: number;
  failed: number;
  results: ImportItemResult[];
}

export const listTaskPacks = async (): Promise<TaskPackSummary[]> =>
  (await api.get<TaskPackSummary[]>('/task-packs')).data;

export const createTaskPack = async (name: string, taskIds: string[]): Promise<TaskPackSummary> =>
  (await api.post<TaskPackSummary>('/task-packs', { name, taskIds })).data;

export const deleteTaskPack = async (id: string): Promise<void> => {
  await api.delete(`/task-packs/${id}`);
};

export const previewTaskPack = async (code: string): Promise<TaskPackPreview> =>
  (await api.get<TaskPackPreview>(`/task-packs/code/${encodeURIComponent(code)}`)).data;

export const importTaskPack = async (
  code: string,
  items: { itemId: string; areaId?: string }[],
): Promise<ImportTaskPackResult> =>
  (await api.post<ImportTaskPackResult>(`/task-packs/code/${encodeURIComponent(code)}/import`, { items })).data;

export const packShareUrl = (code: string): string => `${window.location.origin}/packs/${code}`;

/** Campos de um item que o dono pode atualizar (iguais para toda a turma). */
export interface PackSharedFields {
  title: string;
  date: string;
  weightPercentage: number | null;
  effort: Effort | null;
  dateCertainty: DateCertainty;
  availableFrom: string | null;
  isBlocked: boolean;
}

export interface PackSyncResult {
  updatedItems: number;
  proposalsCreated: number;
}

export interface PackUpdate {
  id: string;
  taskId: string;
  taskTitle: string;
  packName: string;
  ownerName: string;
  changes: Partial<PackSharedFields>;
  current: PackSharedFields;
  createdAt: string;
}

export const publishTaskPack = async (id: string): Promise<PackSyncResult> =>
  (await api.post<PackSyncResult>(`/task-packs/${id}/publish`)).data;

export const listPackUpdates = async (): Promise<PackUpdate[]> =>
  (await api.get<PackUpdate[]>('/task-packs/updates')).data;

export const acceptPackUpdate = async (id: string): Promise<void> => {
  await api.post(`/task-packs/updates/${id}/accept`);
};

export const rejectPackUpdate = async (id: string): Promise<void> => {
  await api.post(`/task-packs/updates/${id}/reject`);
};
