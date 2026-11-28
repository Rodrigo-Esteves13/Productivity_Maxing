import { useCallback, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { bulkRescheduleTasks } from '../api/tasksService';
import { translateNow } from '../i18n/translate';
import { applyBulkReschedule } from '../lib/taskReschedule';
import type { Task } from '../types/models';

// Aplica um plano de "replanear atrasadas": uma chamada por dia de destino.
// Cada dia gravado aparece logo na lista; so se volta a pedir tudo quando
// algo ficou a meio (um pedido falhou ou o servidor moveu menos do que o
// pedido), porque ai nao se sabe o que mudou.
export function useTaskReplan(
  setTasks: Dispatch<SetStateAction<Task[]>>,
  refreshTasks: () => Promise<void>,
) {
  const [replanError, setReplanError] = useState<string | null>(null);
  const clearReplanError = useCallback(() => setReplanError(null), []);

  const replanTasks = useCallback(
    async (moves: { id: string; date: string }[]): Promise<boolean> => {
      const byDate = new Map<string, string[]>();
      for (const move of moves) byDate.set(move.date, [...(byDate.get(move.date) ?? []), move.id]);
      let isPartial = false;
      try {
        for (const [day, ids] of byDate) {
          const date = new Date(day).toISOString();
          const { count } = await bulkRescheduleTasks(ids, date);
          if (count < ids.length) isPartial = true;
          else setTasks((prev) => applyBulkReschedule(prev, new Set(ids), date));
        }
      } catch {
        setReplanError(translateNow('replan.error'));
        void refreshTasks();
        return false;
      }
      if (isPartial) void refreshTasks();
      return true;
    },
    [setTasks, refreshTasks],
  );

  return { replanTasks, replanError, clearReplanError };
}
