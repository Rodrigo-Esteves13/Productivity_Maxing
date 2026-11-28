import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { reorderTasks, updateTask } from '../api/tasksService';
import type { Task } from '../types/models';
import { useCompleteWithUndo } from './useCompleteWithUndo';
import { useFeedback } from '../context/useFeedback';
import { translateNow } from '../i18n/translate';

interface TaskListActionsOptions {
  tasks: Task[];
  setTasks: Dispatch<SetStateAction<Task[]>>;
  selectedTask: Task | null;
  setSelectedTask: Dispatch<SetStateAction<Task | null>>;
}

// Mudancas de um so campo sem abrir o formulario: concluir, estado, area,
// pin, prioridade sugerida e ordem manual.
export function useTaskListActions({ tasks, setTasks, selectedTask, setSelectedTask }: TaskListActionsOptions) {
  const { notify } = useFeedback();
  // Swipe para a direita nos cartoes (Undo na mensagem).
  const { completeOne: completeTask } = useCompleteWithUndo(setTasks);

  // Lightweight counterpart to handleUpdateTask - sends only the one
  // changed field instead of a whole TaskEditForm payload. Safe because
  // UpdateTaskDto on the backend is a PartialType(CreateTaskDto) (same
  // reasoning bulkUpdateTaskStatus already relies on); this is what the
  // 'c' keyboard shortcut calls, so completing a task doesn't require
  // opening the edit form first.
  // Passa por completeTask (completeOne): toast com Desfazer, tasks criadas
  // ao concluir e a pergunta "acabaste a tempo?", como no swipe (U-A05).
  const markSelectedTaskComplete = useCallback(async () => {
    if (!selectedTask || selectedTask.progressStatus === 'COMPLETED') return;
    await completeTask(selectedTask);
  }, [selectedTask, completeTask]);

  // Aplica a prioridade sugerida (decisao do user, so um PATCH da prioridade).
  const applyPrioritySuggestion = useCallback(
    async (key: string) => {
      if (!selectedTask) return;
      try {
        const updated = await updateTask(selectedTask.id, { priority: key });
        setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
        setSelectedTask(updated);
      } catch {
        notify(translateNow('hook.couldNotSaveTheChanges'), 'error');
      }
    },
    [selectedTask, setTasks, setSelectedTask, notify],
  );

  // Quadro Kanban: mudar de coluna = mudar o estado. Concluir passa pelo
  // completeTask (Undo e tasks criadas ao concluir); o resto e otimista
  // (o cartao muda logo de coluna) e volta atras se o PATCH falhar.
  const changeTaskStatus = useCallback(
    async (task: Task, status: string) => {
      if (task.progressStatus === status) return;
      if (status === 'COMPLETED') {
        await completeTask(task);
        return;
      }
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, progressStatus: status as Task['progressStatus'] } : t)),
      );
      try {
        const { spawnedTasks: ignored, ...updated } = await updateTask(task.id, { progressStatus: status });
        void ignored;
        setTasks((prev) => prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)));
      } catch {
        setTasks((prev) => prev.map((t) => (t.id === task.id ? task : t)));
        notify(translateNow('board.moveFailed'), 'error');
      }
    },
    [completeTask, setTasks, notify],
  );

  // Same partial-PATCH pattern as markSelectedTaskComplete, but for any
  // task in the list (not just the one open in the detail modal) - this
  // is what the quick Area dropdown on each TaskCard calls, so
  // recategorizing a task doesn't require opening it first.
  const moveTaskToArea = useCallback(
    async (task: Task, areaId: string) => {
      if (task.areaId === areaId) return;
      try {
        const updated = await updateTask(task.id, { areaId });
        setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
        setSelectedTask((prev) => (prev?.id === updated.id ? updated : prev));
      } catch {
        notify(translateNow('hook.couldNotMoveTheTaskTo'), 'error');
      }
    },
    [setTasks, setSelectedTask, notify],
  );

  // Same partial-PATCH pattern as moveTaskToArea/markSelectedTaskComplete
  // - works on any task in the list, not just the one open in the detail
  // modal, since pinning happens from the card/row directly.
  const toggleTaskPin = useCallback(async (task: Task) => {
    try {
      const updated = await updateTask(task.id, { isPinned: !task.isPinned });
      setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      setSelectedTask((prev) => (prev?.id === updated.id ? updated : prev));
    } catch {
      notify(translateNow('hook.couldNotUpdateThePinPlease'), 'error');
    }
  }, [setTasks, setSelectedTask, notify]);

  // Drag-and-drop no TaskGrid. orderedIds é a sequência VISÍVEL completa
  // após o drop (já inclui a task movida na posição nova) - atualiza o
  // estado local otimisticamente (a UI não espera pela rede) e só
  // reverte se o PATCH falhar. Tasks que não estavam em orderedIds (ex:
  // arquivadas e escondidas pelo toggle "Show archived") mantêm a sua
  // posição relativa entre si, só são empurradas para depois das que
  // foram reordenadas.
  const reorderTasksInState = useCallback(
    async (orderedIds: string[]) => {
      const previousTasks = tasks;
      const indexById = new Map(orderedIds.map((id, i) => [id, i]));
      const newTasks = [...tasks].sort((a, b) => {
        const ai = indexById.get(a.id);
        const bi = indexById.get(b.id);
        if (ai === undefined && bi === undefined) return 0;
        if (ai === undefined) return 1;
        if (bi === undefined) return -1;
        return ai - bi;
      });
      setTasks(newTasks);

      try {
        await reorderTasks(orderedIds);
      } catch {
        setTasks(previousTasks);
        notify(translateNow('hook.couldNotSaveTheNewOrder'), 'error');
      }
    },
    [tasks, setTasks, notify],
  );

  return {
    completeTask,
    markSelectedTaskComplete,
    applyPrioritySuggestion,
    changeTaskStatus,
    moveTaskToArea,
    toggleTaskPin,
    reorderTasksInState,
  };
}
