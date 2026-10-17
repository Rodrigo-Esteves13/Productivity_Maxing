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
