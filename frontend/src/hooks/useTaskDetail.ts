import { useCallback, useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as bus from '../lib/bus';
import type { Subtask, Task } from '../types/models';

// A task aberta no modal de detalhe/edicao e o que a mantem igual a da lista.
// `isStale`: a lista ainda e a do periodo anterior, o ?open= espera pela nova.
export function useTaskDetail(tasks: Task[], setTasks: Dispatch<SetStateAction<Task[]>>, isStale: boolean) {
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Resposta a "acabaste a tempo?" gravada: o detalhe aberto mostra-a (a
  // lista trata-se em usePeriodTasks).
  useEffect(
    () =>
      bus.on('tasks:onTimeSaved', (saved) => {
        setSelectedTask((prev) => (prev?.id === saved.id ? { ...prev, ...saved } : prev));
      }),
    [],
  );

  const handleSelectTask = useCallback((task: Task) => {
    setSelectedTask(task);
    setIsEditing(false);
  }, []);

  const closeDetailModal = useCallback(() => {
    setSelectedTask(null);
    setIsEditing(false);
  }, []);

  const toggleEditing = useCallback(() => setIsEditing((prev) => !prev), []);
  const stopEditing = useCallback(() => setIsEditing(false), []);

  // Lets other parts of the app (the command palette's task search) link
  // straight to a task's detail modal via /tasks?open=<id>, without needing
  // to know anything about how this page renders its list. Waits for
  // `tasks` to be loaded before it can find a match; clears the param once
  // handled so a page refresh or Back doesn't re-open the same modal.
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const openId = searchParams.get('open');
    if (!openId || tasks.length === 0 || isStale) return;

    const match = tasks.find((t) => t.id === openId);
    if (match) {
      handleSelectTask(match);
    }

    const next = new URLSearchParams(searchParams);
    next.delete('open');
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, searchParams, isStale]);

  // Concluir/desfazer pela lista ou pelo toast: o detalhe aberto mostra o
  // mesmo estado (so estes dois campos, para nao pisar uma edicao em curso).
  useEffect(() => {
    setSelectedTask((prev) => {
      if (!prev) return prev;
      const match = tasks.find((t) => t.id === prev.id);
      if (!match) return prev;
      if (match.progressStatus === prev.progressStatus && match.completedAt === prev.completedAt) return prev;
      return { ...prev, progressStatus: match.progressStatus, completedAt: match.completedAt };
    });
  }, [tasks]);

  // Checklist alterada no detalhe: espalha pela lista e pelo detalhe aberto
  // (o contador "2/5" dos cards atualiza sem recarregar).
  const handleSubtasksChange = useCallback(
    (taskId: string, subtasks: Subtask[]) => {
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, subtasks } : t)));
      setSelectedTask((prev) => (prev?.id === taskId ? { ...prev, subtasks } : prev));
    },
    [setTasks],
  );

  // Passo promovido a task: entra na lista (o passo ja saiu da checklist
  // via onChange do SubtaskChecklist).
  const handleSubtaskConverted = useCallback(
    (created: Task) => {
      setTasks((prev) => (prev.some((t) => t.id === created.id) ? prev : [...prev, created]));
    },
    [setTasks],
  );

  return {
    selectedTask,
    setSelectedTask,
    isEditing,
    setIsEditing,
    handleSelectTask,
    closeDetailModal,
    toggleEditing,
    stopEditing,
    handleSubtasksChange,
    handleSubtaskConverted,
  };
}
