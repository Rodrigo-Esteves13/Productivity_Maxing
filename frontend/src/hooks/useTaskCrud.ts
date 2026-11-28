import { useCallback, useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { useSearchParams } from 'react-router-dom';
import { createTask, deleteTask, updateTask } from '../api/tasksService';
import { unsyncTaskFromCalendar } from '../api/calendarService';
import { addSubtasksBulk } from '../api/subtasksService';
import type { Task, TaskFormSubmission, TaskTypeOption, TaskWriteInput } from '../types/models';
import { useUndoableDelete } from './useUndoableDelete';
import { useTaskCalendarSync } from './useTaskCalendarSync';
import { restoreTask } from '../lib/restoreTask';
import { useFeedback } from '../context/useFeedback';
import { translateNow } from '../i18n/translate';
import { askIfFinishedOnTime } from '../lib/onTimeQuestion';

// /tasks?new=1 (atalho do icone da app) abre o formulario de criar task.
const NEW_TASK_PARAM = 'new';

interface TaskCrudOptions {
  setTasks: Dispatch<SetStateAction<Task[]>>;
  taskTypes: TaskTypeOption[];
  selectedTask: Task | null;
  setSelectedTask: Dispatch<SetStateAction<Task | null>>;
  setIsEditing: Dispatch<SetStateAction<boolean>>;
  closeDetailModal: () => void;
}

// Criar, editar, apagar e duplicar tasks na pagina Tasks.
export function useTaskCrud({
  setTasks,
  taskTypes,
  selectedTask,
  setSelectedTask,
  setIsEditing,
  closeDetailModal,
}: TaskCrudOptions) {
  const { notify, confirm } = useFeedback();
  const offerUndoDelete = useUndoableDelete();
  const { applyCalendarSync } = useTaskCalendarSync();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const openCreateModal = useCallback(() => setIsCreateModalOpen(true), []);
  const closeCreateModal = useCallback(() => setIsCreateModalOpen(false), []);

  const handleCreateTask = useCallback(async (taskData: TaskFormSubmission | TaskWriteInput): Promise<Task> => {
    // syncToCalendar é só de UI - o backend (whitelist: true,
    // forbidNonWhitelisted: true) rejeitaria a criação se este campo fosse
    // enviado no payload de Task.
    // subtasks tambem e so de UI: vai a seguir por /subtasks/bulk.
    const { syncToCalendar, subtasks: subtaskTitles, ...taskPayload } = taskData as TaskWriteInput & {
      syncToCalendar?: boolean;
      subtasks?: string[];
    };
    const created = await createTask(taskPayload);
    let createdWithChecklist = created;
    if (subtaskTitles && subtaskTitles.length > 0) {
      try {
        const subtasks = await addSubtasksBulk(created.id, subtaskTitles);
        createdWithChecklist = { ...created, subtasks };
      } catch {
        notify(translateNow('hook.taskCreatedButTheChecklistCould'), 'error');
      }
    }
    const finalTask = await applyCalendarSync(createdWithChecklist, !!syncToCalendar);
    setTasks((prev) =>
      [...prev, finalTask].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
      ),
    );
    setIsCreateModalOpen(false);
    notify(translateNow('quickWins.taskCreated', { title: finalTask.title }), 'success');
    return finalTask;
  }, [applyCalendarSync, notify, setTasks]);

  // Atalho do icone da app (shortcuts do manifest em vite.config.ts):
  // /tasks?new=1 abre logo o formulario de criar. Espera pelos tipos (o
  // formulario escolhe o tipo a partir deles) e limpa o param como o ?open=.
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    if (searchParams.get(NEW_TASK_PARAM) !== '1' || taskTypes.length === 0) return;
    setIsCreateModalOpen(true);
    const next = new URLSearchParams(searchParams);
    next.delete(NEW_TASK_PARAM);
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskTypes, searchParams]);

  // Concluir uma task pode criar outras no backend (proxima ocorrencia de
  // uma recorrente, revisoes espacadas): vem em `spawnedTasks`. Tira-as da
  // task, junta-as a lista e avisa. Devolve a task limpa.
  const absorbSpawnedTasks = useCallback(
    (updated: Task): Task => {
      const { spawnedTasks, ...task } = updated;
      if (spawnedTasks && spawnedTasks.length > 0) {
        setTasks((prev) => {
          const known = new Set(prev.map((t) => t.id));
          return [...prev, ...spawnedTasks.filter((s) => !known.has(s.id))];
        });
        notify(
          spawnedTasks.length === 1
            ? translateNow('hook.tasksSpawnedOne')
            : translateNow('hook.tasksSpawnedMany', { count: spawnedTasks.length }),
          'info',
        );
      }
      return task;
    },
    [notify, setTasks],
  );

  const handleUpdateTask = useCallback(
    async (taskData: TaskFormSubmission): Promise<Task | undefined> => {
      if (!selectedTask) return;
      const { syncToCalendar, subtasks: ignoredSubtasks, ...taskPayload } = taskData;
      void ignoredSubtasks;
      const updated = absorbSpawnedTasks(await updateTask(selectedTask.id, taskPayload));
      // Concluida a partir do formulario de edicao: a mesma pergunta.
      if (selectedTask.progressStatus !== 'COMPLETED' && updated.progressStatus === 'COMPLETED') {
        askIfFinishedOnTime([updated]);
      }
      const finalTask = await applyCalendarSync(updated, !!syncToCalendar);
      setTasks((prev) => prev.map((t) => (t.id === finalTask.id ? finalTask : t)));
      setSelectedTask(finalTask);
      setIsEditing(false);
      notify(translateNow('quickWins.taskUpdated', { title: finalTask.title }), 'success');
      return finalTask;
    },
    [selectedTask, absorbSpawnedTasks, applyCalendarSync, setTasks, setSelectedTask, setIsEditing, notify]
  );

  const handleDeleteTask = useCallback(async () => {
    if (!selectedTask) return;

    const confirmDelete = await confirm({
      title: translateNow('hook.deleteTask'),
      message: translateNow('hook.areYouSureYouWantTo'),
      confirmLabel: translateNow('hook.delete'),
      tone: 'danger',
    });
    if (!confirmDelete) return;

    // Só pergunta se a task estiver mesmo sincronizada - não faz sentido
    // incomodar com uma pergunta sobre um evento que nunca existiu. "OK"
    // fica como resposta por omissão (basta Enter) porque quem tem a task
    // sincronizada normalmente quer os dois lados a condizer.
    const shouldRemoveFromCalendar =
      !!selectedTask.googleCalendarEventId &&
      (await confirm({
        title: translateNow('hook.googleCalendar'),
        message: translateNow('hook.alsoRemoveTheLinkedEventFrom'),
        confirmLabel: translateNow('hook.removeEvent'),
        cancelLabel: translateNow('hook.keepEvent'),
      }));

    try {
      if (shouldRemoveFromCalendar) {
        try {
          await unsyncTaskFromCalendar(selectedTask.id);
        } catch {
          // Falha ao remover do Calendar não deve impedir apagar a task -
          // fica um evento órfão na Google, mas apagável à mão.
        }
      }
      const deleted = selectedTask;
      await deleteTask(deleted.id);
      setTasks((prev) => prev.filter((t) => t.id !== deleted.id));
      closeDetailModal();
      offerUndoDelete({
        message: translateNow('undoDelete.task', { title: deleted.title }),
        restore: () => restoreTask(deleted),
        onRestored: (restored) =>
          setTasks((prev) =>
            [...prev, restored].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
          ),
      });
    } catch {
      notify(translateNow('hook.couldNotDeleteTheTaskPlease'), 'error');
    }
  }, [selectedTask, setTasks, closeDetailModal, confirm, notify, offerUndoDelete]);

  // Função de Duplicar corrigida!
  const handleDuplicateTask = useCallback(async () => {
    if (!selectedTask) return;

    const confirmDuplicate = await confirm({
      title: translateNow('hook.duplicateTask'),
      message: translateNow('hook.doYouWantToDuplicateThis'),
      confirmLabel: translateNow('hook.duplicate'),
    });
    if (!confirmDuplicate) return;

    try {
      // Usamos .type e .academicType para respeitar o model Task do frontend
      const newTaskData = {
        title: translateNow('hook.copySuffix', { title: selectedTask.title }),
        areaId: selectedTask.areaId,
        date: selectedTask.date,
        type: selectedTask.type,
        academicType: selectedTask.academicType,
        topics: selectedTask.topics,
        weightPercentage: selectedTask.weightPercentage,
        difficulty: selectedTask.difficulty,
        referenceLink: selectedTask.referenceLink,
        targetGrade: selectedTask.targetGrade,
        // Copia completa: tudo o que descreve a task em si. O que e estado
        // (progresso, nota real, evento do Calendar, tempo ja estudado)
        // fica de fora de proposito, para a copia comecar limpa.
        periodId: selectedTask.periodId ?? undefined,
        priority: selectedTask.priority ?? undefined,
        notes: selectedTask.notes ?? undefined,
        tags: selectedTask.tags,
        estimatedMinutes: selectedTask.estimatedMinutes ?? undefined,
        calendarDurationMinutes: selectedTask.calendarDurationMinutes ?? undefined,
        // Prontidao e duas fases tambem descrevem a task (o mesmo que um
        // pacote copia).
        effort: selectedTask.effort ?? null,
        dateCertainty: selectedTask.dateCertainty,
        isBlocked: selectedTask.isBlocked,
        availableFrom: selectedTask.availableFrom ?? null,
        submissionDate: selectedTask.submissionDate ?? null,
        // Copia a checklist (todos os passos voltam a "por fazer").
        subtasks: (selectedTask.subtasks ?? []).map((s) => s.title),
      };

      await handleCreateTask(newTaskData);
      closeDetailModal();
    } catch {
      // Falha ao duplicar é sempre um erro de rede/API neste fluxo (a
      // criação em si já trata os seus próprios erros de validação) - não
      // precisamos do objeto de erro para dar uma mensagem útil aqui.
      notify(translateNow('hook.couldNotDuplicateTheTaskPlease'), 'error');
    }
  }, [selectedTask, handleCreateTask, closeDetailModal, confirm, notify]);

  return {
    isCreateModalOpen,
    openCreateModal,
    closeCreateModal,
    handleCreateTask,
    handleUpdateTask,
    handleDeleteTask,
    handleDuplicateTask,
  };
}
