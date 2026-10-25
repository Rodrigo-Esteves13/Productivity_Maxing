import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { bulkDeleteTasks, bulkRescheduleTasks } from '../api/userService';
import { syncTaskToCalendar, unsyncTaskFromCalendar } from '../api/calendarService';
import type { Task } from '../types/models';
import { useCompleteWithUndo } from './useCompleteWithUndo';

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

  const { completeMany } = useCompleteWithUndo(setTasks);

  const markSelectedDone = useCallback(async () => {
    await completeMany(visibleTasks.filter((t) => selectedIds.has(t.id)));
    setSelectedIds(new Set());
  }, [completeMany, selectedIds, visibleTasks]);

  // Mover a selecao para um dia ("YYYY-MM-DD"). Mesma conta local do
  // backend: so as que avancam contam como adiadas, as concluidas nao mexem.
  // Tasks com evento no Google Calendar sao re-sincronizadas como no "+1
  // Day" (useQuickReschedule); falha silenciosa, a task ja esta guardada.
  const rescheduleSelected = useCallback(
    async (dateKey: string) => {
      const date = new Date(dateKey).toISOString();
      const moved = visibleTasks.filter(
        (t) => selectedIds.has(t.id) && t.progressStatus !== COMPLETED_STATUS,
      );
      if (moved.length === 0) return 0;
      const { count } = await bulkRescheduleTasks(moved.map((t) => t.id), date);
      const movedIds = new Set(moved.map((t) => t.id));
      setTasks((prev) =>
        prev.map((t) =>
          movedIds.has(t.id)
            ? {
                ...t,
                date,
                postponedCount: t.postponedCount + (new Date(t.date) < new Date(date) ? 1 : 0),
              }
            : t,
        ),
      );
      setSelectedIds(new Set());
      for (const task of moved.filter((t) => t.googleCalendarEventId)) {
        try {
          await syncTaskToCalendar(task.id);
        } catch (syncError: unknown) {
          console.error('Error re-syncing task with Google Calendar:', syncError);
        }
      }
      return count;
    },
    [selectedIds, setTasks, visibleTasks],
  );

  // Quantas das selecionadas tem evento no Google Calendar: a barra so
  // pergunta "remover tambem os eventos?" quando ha algum (como o apagar
  // individual em useTasksPage).
  const selectedSyncedCount = useMemo(
    () => visibleTasks.filter((t) => selectedIds.has(t.id) && t.googleCalendarEventId).length,
    [selectedIds, visibleTasks],
  );

  // removeFromCalendar: remove primeiro os eventos ligados (antes do delete,
  // depois ja nao ha task para o backend encontrar o evento). Uma falha no
  // Calendar nao impede apagar, tal como no apagar individual.
  const deleteSelected = useCallback(async (removeFromCalendar = false) => {
    const ids = Array.from(selectedIds);
    if (removeFromCalendar) {
      const synced = visibleTasks.filter((t) => selectedIds.has(t.id) && t.googleCalendarEventId);
      for (const task of synced) {
        try {
          await unsyncTaskFromCalendar(task.id);
        } catch (unsyncError: unknown) {
          console.error('Error removing task event from Google Calendar:', unsyncError);
        }
      }
    }
    await bulkDeleteTasks(ids);
    const deleted = new Set(ids);
    setTasks((prev) => prev.filter((t) => !deleted.has(t.id)));
    setSelectedIds(new Set());
  }, [selectedIds, setTasks, visibleTasks]);

  return {
    selectedIds,
    toggleSelect,
    toggleSelectAll,
    markSelectedDone,
    rescheduleSelected,
    deleteSelected,
    selectedSyncedCount,
    clearSelection,
  };
}
