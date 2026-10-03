import { useCallback, useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { bulkDeleteTasks, bulkUpdateTaskStatus } from '../api/userService';
import type { Task } from '../types/models';

const COMPLETED_STATUS = 'COMPLETED';

// Selecao de linhas da tabela e acoes em massa. `resetKey` limpa a selecao
// quando muda (ex: filtros), porque uma selecao de tarefas que ja nao se
// veem confunde mais do que ajuda.
export function useTaskSelection(
  visibleTasks: Task[],
  setTasks: Dispatch<SetStateAction<Task[]>>,
  resetKey: unknown,
) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setSelectedIds(new Set());
  }, [resetKey]);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      const allSelected = visibleTasks.length > 0 && visibleTasks.every((t) => prev.has(t.id));
      return allSelected ? new Set() : new Set(visibleTasks.map((t) => t.id));
    });
  }, [visibleTasks]);

  const markSelectedDone = useCallback(async () => {
    const ids = Array.from(selectedIds);
    await bulkUpdateTaskStatus(ids, COMPLETED_STATUS);
    setTasks((prev) =>
      prev.map((t) =>
        ids.includes(t.id)
          ? { ...t, progressStatus: COMPLETED_STATUS, completedAt: t.completedAt ?? new Date().toISOString() }
          : t,
      ),
    );
    setSelectedIds(new Set());
  }, [selectedIds, setTasks]);

  const deleteSelected = useCallback(async () => {
    const ids = Array.from(selectedIds);
    await bulkDeleteTasks(ids);
    setTasks((prev) => prev.filter((t) => !ids.includes(t.id)));
    setSelectedIds(new Set());
  }, [selectedIds, setTasks]);

  return { selectedIds, toggleSelect, toggleSelectAll, markSelectedDone, deleteSelected, clearSelection };
}
