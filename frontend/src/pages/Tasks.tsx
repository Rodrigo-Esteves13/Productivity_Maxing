import { useCallback, useEffect, useState } from 'react';
import PageLayout from '../components/Layout/PageLayout';
import PageHeader from '../components/Layout/PageHeader';
import TaskGrid from '../components/Tasks/TaskGrid';
import TaskDetailView from '../components/Tasks/TaskDetailView';
import TaskEditForm from '../components/Tasks/TaskEditForm';
import Modal from '../components/UI/Modal';
import TaskForm from '../components/Tasks/TaskForm';
import ActionButton from '../components/UI/ActionButton';
import LoadingState from '../components/UI/LoadingState';
import ErrorState from '../components/UI/ErrorState';
import EmptyState from '../components/UI/EmptyState';
import ModalHeaderActions from '../components/UI/ModalHeaderActions';
import {
  getUserTasks,
  getUserAreas,
  createTask,
  updateTask,
  getTaskMetadata,
  deleteTask,
} from '../api/userService';
import type { Task, Area } from '../types/models';

export default function Tasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);

  // Metadados dinâmicos
  const [taskTypes, setTaskTypes] = useState<string[]>([]);
  const [difficulties, setDifficulties] = useState<string[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Estado do modal de detalhe/edição
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isEditing, setIsEditing] = useState(false);

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
      setDifficulties(metaData.difficulties);
    } catch (err) {
      setError('Não foi possível carregar os dados.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateTask = async (taskData: any) => {
    await createTask(taskData);
    setIsCreateModalOpen(false);
    fetchData();
  };

  const handleSelectTask = useCallback((task: Task) => {
    setSelectedTask(task);
    setIsEditing(false);
  }, []);

  const closeDetailModal = useCallback(() => {
    setSelectedTask(null);
    setIsEditing(false);
  }, []);

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
      'Tens a certeza que queres apagar esta tarefa? Esta ação é irreversível.'
    );

    if (!confirmDelete) return;

    try {
      await deleteTask(selectedTask.id);
      setTasks((prev) => prev.filter((t) => t.id !== selectedTask.id));
      closeDetailModal();
    } catch (err) {
      alert('Não foi possível apagar a tarefa. Tenta novamente.');
    }
  }, [selectedTask, closeDetailModal]);

  return (
    <PageLayout>
      <PageHeader
        title="As Minhas Tarefas"
        description="Gere, filtra e acompanha o progresso de todas as tuas tarefas."
        action={
          <ActionButton color="violet" onClick={() => setIsCreateModalOpen(true)}>
            + Nova Tarefa
          </ActionButton>
        }
      />

      {isLoading ? (
        <LoadingState message="A carregar dados..." className="h-64" />
      ) : error ? (
        <ErrorState message={error} />
      ) : tasks.length === 0 ? (
        <EmptyState message="Não tens tarefas registadas." />
      ) : (
        <TaskGrid tasks={tasks} onSelect={handleSelectTask} />
      )}

      {/* Modal de criação */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Criar Nova Tarefa"
      >
        <TaskForm
          onSubmit={handleCreateTask}
          onCancel={() => setIsCreateModalOpen(false)}
          areas={areas}
          taskTypes={taskTypes}
          difficulties={difficulties}
        />
      </Modal>

      {/* Modal de detalhe / edição */}
      <Modal
        isOpen={selectedTask !== null}
        onClose={closeDetailModal}
        title={isEditing ? 'Editar Tarefa' : 'Detalhes da Tarefa'}
        action={
          selectedTask && (
            <ModalHeaderActions
              isEditing={isEditing}
              onToggleEdit={() => setIsEditing((prev) => !prev)}
              onDelete={handleDeleteTask}
              deleteTitle="Apagar tarefa"
              editTitle="Editar tarefa"
            />
          )
        }
      >
        {selectedTask &&
          (isEditing ? (
            <TaskEditForm
              task={selectedTask}
              onSubmit={handleUpdateTask}
              onCancel={() => setIsEditing(false)}
              areas={areas}
              taskTypes={taskTypes}
              difficulties={difficulties}
            />
          ) : (
            <TaskDetailView task={selectedTask} />
          ))}
      </Modal>
    </PageLayout>
  );
}
