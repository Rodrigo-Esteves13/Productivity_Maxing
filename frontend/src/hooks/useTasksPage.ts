import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  getUserTasks,
  getUserAreas,
  createTask,
  updateTask,
  getTaskMetadata,
  deleteTask,
} from '../api/userService';
import { syncTaskToCalendar, unsyncTaskFromCalendar } from '../api/calendarService';
import type { Task, Area, TaskTypeOption, AcademicTaskTypeOption } from '../types/models';
import { useQuickReschedule } from './useQuickReschedule';
import { useAcademic } from '../context/useAcademic';

export function useTasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);

  const [taskTypes, setTaskTypes] = useState<TaskTypeOption[]>([]);
  const [academicTaskTypes, setAcademicTaskTypes] = useState<AcademicTaskTypeOption[]>([]);
  const [difficulties, setDifficulties] = useState<string[]>([]);
  const [progressStatuses, setProgressStatuses] = useState<string[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Hook do reagendamento (Feature anterior)
  const { rescheduleToTomorrow, reschedulingId } = useQuickReschedule((updatedTask) => {
    setTasks((prev) => prev.map((t) => (t.id === updatedTask.id ? updatedTask : t)));
  });

  // Segue sempre o período selecionado no topo da página (PeriodSelector).
  // "No program" (isViewingAllPrograms) também cai no 'all' do backend -
  // esse filtro já não tem qualquer restrição de periodId, logo já
  // devolve as tasks de todos os programas, não só do período ativo.
  const { activePeriod, isViewingAllPeriods, isViewingAllPrograms, isLoading: isAcademicLoading } = useAcademic();
  const periodParam = isViewingAllPeriods || isViewingAllPrograms ? 'all' : activePeriod?.id;

  const [isTasksLoading, setIsTasksLoading] = useState(true);
  const [isMetaLoading, setIsMetaLoading] = useState(true);
  // Kept as a single derived flag for every existing `isLoading` read
  // below/in Tasks.tsx - true exactly when it used to be true.
  const isLoading = isTasksLoading || isMetaLoading;

  // Same split as Dashboard.tsx's fetch effects, and the same reason:
  // Areas + task metadata don't depend on periodParam at all (getUserAreas
  // and getTaskMetadata take no arguments), so there's no reason for them
  // to wait behind AcademicContext's own load (getPrograms ->
  // getProgramPeriods) just because they used to share one Promise.all
  // with the tasks fetch that DOES need periodParam.
  const fetchMeta = async () => {
    try {
      setIsMetaLoading(true);
      const [areasData, metaData] = await Promise.all([getUserAreas(), getTaskMetadata()]);
      setAreas(areasData);
      setTaskTypes(metaData.taskTypes);
      setAcademicTaskTypes(metaData.academicTaskTypes);
      setDifficulties(metaData.difficulties);
      setProgressStatuses(metaData.progressStatuses);
    } catch {
      setError('Could not load the data.');
    } finally {
      setIsMetaLoading(false);
    }
  };

  const fetchTasks = async () => {
    try {
      setIsTasksLoading(true);
      const tasksData = await getUserTasks(periodParam);
      setTasks(tasksData);
    } catch {
      setError('Could not load the data.');
    } finally {
      setIsTasksLoading(false);
    }
  };

  useEffect(() => {
    fetchMeta();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // See Dashboard.tsx's identical guard: without this, periodParam is
    // briefly `undefined` before AcademicContext resolves
    // activePeriod, firing this effect once wastefully, then again a
    // moment later with the real value.
    if (isAcademicLoading) return;
    fetchTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodParam, isAcademicLoading]);

  // Aplica o resultado da checkbox "Add to Google Calendar" depois de criar
  // ou atualizar uma task. Nunca lança - se a chamada ao Google falhar, a
  // task em si já foi guardada com sucesso; falhar aqui só significa que o
  // evento não foi criado/removido, e o botão de sync no Dashboard
  // (CalendarSyncButton) fica sempre disponível para tentar outra vez.
  const applyCalendarSync = async (task: Task, syncToCalendar: boolean): Promise<Task> => {
    try {
      if (syncToCalendar) {
        const { googleCalendarEventId } = await syncTaskToCalendar(task.id);
        return { ...task, googleCalendarEventId };
      }
      if (task.googleCalendarEventId) {
        await unsyncTaskFromCalendar(task.id);
        return { ...task, googleCalendarEventId: null };
      }
    } catch {
      // falha silenciosa de propósito - ver comentário acima
    }
    return task;
  };

  const openCreateModal = () => setIsCreateModalOpen(true);
  const closeCreateModal = () => setIsCreateModalOpen(false);

  const handleCreateTask = async (taskData: any) => {
    // syncToCalendar é só de UI - o backend (whitelist: true,
    // forbidNonWhitelisted: true) rejeitaria a criação se este campo fosse
    // enviado no payload de Task.
    const { syncToCalendar, ...taskPayload } = taskData;
    const created = await createTask(taskPayload);
    const finalTask = await applyCalendarSync(created, !!syncToCalendar);
    setTasks((prev) =>
      [...prev, finalTask].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
      ),
    );
    setIsCreateModalOpen(false);
    return finalTask;
  };

  const handleSelectTask = useCallback((task: Task) => {
    setSelectedTask(task);
    setIsEditing(false);
  }, []);

  // Lets other parts of the app (the command palette's task search) link
  // straight to a task's detail modal via /tasks?open=<id>, without needing
  // to know anything about how this page renders its list. Waits for
  // `tasks` to be loaded (fetchData is async) before it can find a match;
  // clears the param once handled so a page refresh or Back doesn't
  // re-open the same modal.
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const openId = searchParams.get('open');
    if (!openId || tasks.length === 0) return;

    const match = tasks.find((t) => t.id === openId);
    if (match) {
      handleSelectTask(match);
    }

    const next = new URLSearchParams(searchParams);
    next.delete('open');
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks]);

  const closeDetailModal = useCallback(() => {
    setSelectedTask(null);
    setIsEditing(false);
  }, []);

  const toggleEditing = useCallback(() => setIsEditing((prev) => !prev), []);
  const stopEditing = useCallback(() => setIsEditing(false), []);

  const handleUpdateTask = useCallback(
    async (taskData: any) => {
      if (!selectedTask) return;
      const { syncToCalendar, ...taskPayload } = taskData;
      const updated = await updateTask(selectedTask.id, taskPayload);
      const finalTask = await applyCalendarSync(updated, !!syncToCalendar);
      setTasks((prev) => prev.map((t) => (t.id === finalTask.id ? finalTask : t)));
      setSelectedTask(finalTask);
      setIsEditing(false);
      return finalTask;
    },
    [selectedTask]
  );

  const handleDeleteTask = useCallback(async () => {
    if (!selectedTask) return;

    const confirmDelete = window.confirm(
      'Are you sure you want to delete this task? This action is irreversible.'
    );
    if (!confirmDelete) return;

    // Só pergunta se a task estiver mesmo sincronizada - não faz sentido
    // incomodar com uma pergunta sobre um evento que nunca existiu. "OK"
    // fica como resposta por omissão (basta Enter) porque quem tem a task
    // sincronizada normalmente quer os dois lados a condizer.
    const shouldRemoveFromCalendar =
      !!selectedTask.googleCalendarEventId &&
      window.confirm('Also remove the linked event from Google Calendar?');

    try {
      if (shouldRemoveFromCalendar) {
        try {
          await unsyncTaskFromCalendar(selectedTask.id);
        } catch {
          // Falha ao remover do Calendar não deve impedir apagar a task -
          // fica um evento órfão na Google, mas apagável à mão.
        }
      }
      await deleteTask(selectedTask.id);
      setTasks((prev) => prev.filter((t) => t.id !== selectedTask.id));
      closeDetailModal();
    } catch {
      alert('Could not delete the task. Please try again.');
    }
  }, [selectedTask, closeDetailModal]);

  // Função de Duplicar corrigida!
  const handleDuplicateTask = useCallback(async () => {
    if (!selectedTask) return;

    const confirmDuplicate = window.confirm(
      'Do you want to duplicate this task? A clean copy will be created.'
    );
    if (!confirmDuplicate) return;

    try {
      // Usamos .type e .academicType para respeitar o model Task do frontend
      const newTaskData = {
        title: `${selectedTask.title} (Copy)`,
        areaId: selectedTask.areaId,
        date: selectedTask.date,
        type: selectedTask.type,
        academicType: selectedTask.academicType,
        topics: selectedTask.topics,
        weightPercentage: selectedTask.weightPercentage,
        difficulty: selectedTask.difficulty,
        referenceLink: selectedTask.referenceLink,
        targetGrade: selectedTask.targetGrade,
      };

      await handleCreateTask(newTaskData);
      closeDetailModal();
    } catch {
      // Falha ao duplicar é sempre um erro de rede/API neste fluxo (a
      // criação em si já trata os seus próprios erros de validação) - não
      // precisamos do objeto de erro para dar uma mensagem útil aqui.
      alert('Could not duplicate the task. Please check your connection.');
    }
  }, [selectedTask, closeDetailModal]);
  // Não coloquei 'handleCreateTask' nas dependências para evitar loop de re-renders

  // Lightweight counterpart to handleUpdateTask - sends only the one
  // changed field instead of a whole TaskEditForm payload. Safe because
  // UpdateTaskDto on the backend is a PartialType(CreateTaskDto) (same
  // reasoning bulkUpdateTaskStatus already relies on); this is what the
  // 'c' keyboard shortcut calls, so completing a task doesn't require
  // opening the edit form first.
  const markSelectedTaskComplete = useCallback(async () => {
    if (!selectedTask || selectedTask.progressStatus === 'COMPLETED') return;
    try {
      const updated = await updateTask(selectedTask.id, { progressStatus: 'COMPLETED' });
      setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      setSelectedTask(updated);
    } catch {
      alert('Could not mark the task as completed. Please try again.');
    }
  }, [selectedTask]);

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
        alert('Could not move the task to that area. Please try again.');
      }
    },
    [],
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
      alert('Could not update the pin. Please try again.');
    }
  }, []);

  return {
    tasks,
    areas,
    taskTypes,
    academicTaskTypes,
    difficulties,
    progressStatuses,
    isLoading,
    error,
    isCreateModalOpen,
    selectedTask,
    isEditing,
    openCreateModal,
    closeCreateModal,
    handleCreateTask,
    handleSelectTask,
    closeDetailModal,
    toggleEditing,
    stopEditing,
    handleUpdateTask,
    handleDeleteTask,
    rescheduleToTomorrow,
    reschedulingId,
    handleDuplicateTask,
    markSelectedTaskComplete,
    moveTaskToArea,
    toggleTaskPin,
  };
}