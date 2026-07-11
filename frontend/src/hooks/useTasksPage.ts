import { useCallback, useEffect, useState } from 'react';
import {
  getUserTasks,
  getUserAreas,
  createTask,
  updateTask,
  getTaskMetadata,
  deleteTask,
} from '../api/userService';
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

  const openCreateModal = () => setIsCreateModalOpen(true);
  const closeCreateModal = () => setIsCreateModalOpen(false);

  const handleCreateTask = async (taskData: any) => {
    const created = await createTask(taskData);
    setTasks((prev) =>
      [...prev, created].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
      ),
    );
    setIsCreateModalOpen(false);
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
      const updated = await updateTask(selectedTask.id, taskData);
      setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      setSelectedTask(updated);
      setIsEditing(false);
    },
    [selectedTask]
  );

  const handleDeleteTask = useCallback(async () => {
    if (!selectedTask) return;

    const confirmDelete = window.confirm(
      'Are you sure you want to delete this task? This action is irreversible.'
    );
    if (!confirmDelete) return;

    try {
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
      'Queres duplicar esta tarefa? Será criada uma cópia limpa.'
    );
    if (!confirmDuplicate) return;

    try {
      // Usamos .type e .academicType para respeitar o model Task do frontend
      const newTaskData = {
        title: `${selectedTask.title} (Cópia)`,
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
      alert('Não foi possível duplicar a tarefa. Verifica a tua ligação.');
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