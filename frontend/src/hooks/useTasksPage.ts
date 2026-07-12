import { useCallback, useEffect, useState } from 'react';
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

export function useTasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);

  const [taskTypes, setTaskTypes] = useState<TaskTypeOption[]>([]);
  const [academicTaskTypes, setAcademicTaskTypes] = useState<AcademicTaskTypeOption[]>([]);
  const [difficulties, setDifficulties] = useState<string[]>([]);
  const [progressStatuses, setProgressStatuses] = useState<string[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Hook do reagendamento (Feature anterior)
  const { rescheduleToTomorrow, reschedulingId } = useQuickReschedule((updatedTask) => {
    setTasks((prev) => prev.map((t) => (t.id === updatedTask.id ? updatedTask : t)));
  });

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [tasksData, areasData, metaData] = await Promise.all([
        getUserTasks(),
        getUserAreas(),
        getTaskMetadata(),
      ]);
      setTasks(tasksData);
      setAreas(areasData);
      setTaskTypes(metaData.taskTypes);
      setAcademicTaskTypes(metaData.academicTaskTypes);
      setDifficulties(metaData.difficulties);
      setProgressStatuses(metaData.progressStatuses);
    } catch {
      setError('Could not load the data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

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
  };
}