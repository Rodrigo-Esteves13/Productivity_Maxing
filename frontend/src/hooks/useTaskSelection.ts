import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { bulkDeleteTasks, bulkRescheduleTasks, bulkSetTaskEffort } from '../api/tasksService';
import { syncTaskToCalendar, unsyncTaskFromCalendar } from '../api/calendarService';
import type { Task } from '../types/models';
import { useCompleteWithUndo } from './useCompleteWithUndo';
import { useUndoableDelete } from './useUndoableDelete';
import { TASK_UNDO_MAX } from '../lib/batch';
import { restoreTasks } from '../lib/restoreTask';
import { applyBulkReschedule } from '../lib/taskReschedule';
import { translateNow } from '../i18n/translate';

const COMPLETED_STATUS = 'COMPLETED';

// Selecao de linhas (tabela ou cartoes) e acoes em massa. `resetKey` limpa a
// selecao quando muda (ex: filtros), porque uma selecao de tarefas que ja nao
// se veem confunde mais do que ajuda. Uma task que saia de `visibleTasks` (ex:
// concluida com o filtro "pendentes") deixa de contar como selecionada.
export function useTaskSelection(
  visibleTasks: Task[],
  setTasks: Dispatch<SetStateAction<Task[]>>,
  resetKey: unknown,
) {
  const [pickedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const selectedIds = useMemo(
    () => new Set(visibleTasks.filter((t) => pickedIds.has(t.id)).map((t) => t.id)),
    [pickedIds, visibleTasks],
  );

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

  // "Selecionar tudo" de uma lista parcial (cartoes ja desenhados): marca as
  // que faltam; se ja estavam todas, desmarca-as.
  const toggleSelectMany = useCallback((ids: string[]) => {
    setSelectedIds((prev) => {
      const allSelected = ids.length > 0 && ids.every((id) => prev.has(id));
      const next = new Set(prev);
      for (const id of ids) {
        if (allSelected) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  }, []);

  const { completeMany } = useCompleteWithUndo(setTasks);
  const offerUndoDelete = useUndoableDelete();

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
      setTasks((prev) => applyBulkReschedule(prev, movedIds, date));
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

  // "Set effort" da selecao (null limpa). Devolve quantas ficaram alteradas.
  const setEffortSelected = useCallback(
    async (effort: Task['effort']) => {
      const ids = Array.from(selectedIds);
      if (ids.length === 0) return 0;
      const { count } = await bulkSetTaskEffort(ids, effort);
      const changed = new Set(ids);
      setTasks((prev) => prev.map((t) => (changed.has(t.id) ? { ...t, effort } : t)));
      setSelectedIds(new Set());
      return count;
    },
    [selectedIds, setTasks],
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
    // Guardadas antes de apagar: e com elas que o "Anular" recria.
    const removed = visibleTasks.filter((t) => selectedIds.has(t.id));
    await bulkDeleteTasks(ids);
    const deleted = new Set(ids);
    setTasks((prev) => prev.filter((t) => !deleted.has(t.id)));
    setSelectedIds(new Set());
    // Acima do limite nao ha Anular (a confirmacao avisa).
    if (ids.length > TASK_UNDO_MAX) return;
    offerUndoDelete({
      message: translateNow(ids.length === 1 ? 'ux4global.tasks.deletedOne' : 'ux4global.tasks.deletedMany', {
        count: ids.length,
      }),
      restore: async () => {
        const { restored, failed } = await restoreTasks(removed);
        setTasks((prev) =>
          [...prev, ...restored].sort(
            (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
          ),
        );
        if (failed > 0) throw new Error('Some tasks could not be restored.');
      },
    });
  }, [selectedIds, setTasks, visibleTasks, offerUndoDelete]);

  return {
    selectedIds,
    toggleSelect,
    toggleSelectAll,
    toggleSelectMany,
    markSelectedDone,
    rescheduleSelected,
    setEffortSelected,
    deleteSelected,
    selectedSyncedCount,
    clearSelection,
  };
}
