import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { bulkDeleteTasks, bulkUpdateTaskStatus, updateTask } from '../api/userService';
import type { Task } from '../types/models';
import { useFeedback } from '../context/useFeedback';
import { useI18n } from '../i18n/useI18n';

const COMPLETED_STATUS = 'COMPLETED';

type Status = Task['progressStatus'];

// Marcar como feita com "Undo" na mensagem. Desfazer repoe o estado que cada
// task tinha; o backend limpa o completedAt ao sair de COMPLETED.
// - completeMany (selecao do Dashboard): bulk-status, como antes. Nao cria
//   proxima ocorrencia nem revisoes, por isso desfazer e so repor estados
//   (um pedido por estado anterior).
// - completeOne (swipe nos cartoes): PATCH normal, que pode criar a proxima
//   ocorrencia / revisoes espacadas. Desfazer apaga essas tasks novas.
export function useCompleteWithUndo(setTasks: Dispatch<SetStateAction<Task[]>>) {
  const { notify } = useFeedback();
  const { t } = useI18n();

  const applyStatuses = useCallback(
    (previous: Map<string, Status>, completedAt: string | null) => {
      setTasks((prev) =>
        prev.map((task) => {
          const status = previous.get(task.id);
          if (status === undefined) return task;
          return completedAt
            ? { ...task, progressStatus: COMPLETED_STATUS, completedAt }
            : { ...task, progressStatus: status, completedAt: null };
        }),
      );
    },
    [setTasks],
  );

  const offerUndo = useCallback(
    (count: number, undo: () => Promise<void>) => {
      notify(t(count === 1 ? 'undo.doneOne' : 'undo.doneMany', { count }), 'success', {
        label: t('undo.action'),
        onAction: () => {
          undo().catch(() => notify(t('undo.failed'), 'error'));
        },
      });
    },
    [notify, t],
  );

  const completeMany = useCallback(
    async (tasks: Task[]) => {
      const previous = new Map(
        tasks.filter((task) => task.progressStatus !== COMPLETED_STATUS).map((task) => [task.id, task.progressStatus]),
      );
      if (previous.size === 0) return;
      await bulkUpdateTaskStatus([...previous.keys()], COMPLETED_STATUS);
      applyStatuses(previous, new Date().toISOString());

      offerUndo(previous.size, async () => {
        const idsByStatus = new Map<Status, string[]>();
        for (const [id, status] of previous) {
          idsByStatus.set(status, [...(idsByStatus.get(status) ?? []), id]);
        }
        await Promise.all(
          [...idsByStatus].map(([status, ids]) => bulkUpdateTaskStatus(ids, status)),
        );
        applyStatuses(previous, null);
      });
    },
    [applyStatuses, offerUndo],
  );

  const completeOne = useCallback(
    async (task: Task) => {
      if (task.progressStatus === COMPLETED_STATUS) return;
      let response: Task;
      try {
        response = await updateTask(task.id, { progressStatus: COMPLETED_STATUS });
      } catch {
        notify(t('swipe.completeFailed'), 'error');
        return;
      }
      const { spawnedTasks = [], ...updated } = response;
      setTasks((prev) => {
        const known = new Set(prev.map((t) => t.id));
        return [
          ...prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)),
          ...spawnedTasks.filter((s) => !known.has(s.id)),
        ];
      });

      offerUndo(1, async () => {
        const spawnedIds = spawnedTasks.map((s) => s.id);
        const [restored] = await Promise.all([
          updateTask(task.id, { progressStatus: task.progressStatus }),
          spawnedIds.length > 0 ? bulkDeleteTasks(spawnedIds) : Promise.resolve(null),
        ]);
        const { spawnedTasks: ignored, ...clean } = restored;
        void ignored;
        setTasks((prev) =>
          prev
            .filter((t) => !spawnedIds.includes(t.id))
            .map((t) => (t.id === clean.id ? { ...t, ...clean } : t)),
        );
      });
    },
    [notify, offerUndo, setTasks, t],
  );

  return { completeMany, completeOne };
}
