import { useCallback, useEffect, useState } from 'react';
import PageLayout from '../components/Layout/PageLayout';
import PageHeader from '../components/Layout/PageHeader';
import TaskCard from '../components/Tasks/TaskCard';
import TaskDetailView from '../components/Tasks/TaskDetailView';
import TaskEditForm from '../components/Tasks/TaskEditForm';
import Modal from '../components/UI/Modal';
import TaskForm from '../components/Tasks/TaskForm';
// 1. Adicionado o TrashIcon aos imports
import { PencilIcon, XIcon, TrashIcon } from '../components/UI/icons'; 
import {
  getUserTasks,
  getUserAreas,
  createTask,
  updateTask,
  getTaskMetadata,
  deleteTask, // 2. Importada a chamada da API
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

  // 3. Função para apagar a Tarefa
  const handleDeleteTask = useCallback(async () => {
    if (!selectedTask) return;

    // Confirmação simples do browser para não apagar por acidente
    const confirmDelete = window.confirm(
      'Tens a certeza que queres apagar esta tarefa? Esta ação é irreversível.'
    );
    
    if (!confirmDelete) return;

    try {
      await deleteTask(selectedTask.id);
      // Remove da lista atual sem precisar de fazer loading à página toda outra vez
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
      />

      <div className="mb-6 flex gap-4">
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium rounded-md transition-colors"
        >
          + Nova Tarefa
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <p className="text-neutral-400 animate-pulse">A carregar dados...</p>
        </div>
      ) : error ? (
        <div className="p-4 bg-red-900/50 border border-red-500 rounded-lg text-red-200">
          {error}
        </div>
      ) : tasks.length === 0 ? (
        <div className="p-8 text-center bg-neutral-900/50 border border-neutral-800 rounded-xl">
          <p className="text-neutral-400">Não tens tarefas registadas.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} onSelect={handleSelectTask} />
          ))}
        </div>
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
            <div className="flex items-center gap-1">
              {/* 4. Botão de Apagar adicionado ao Modal (só no modo detalhe ou edição) */}
              <button
                onClick={handleDeleteTask}
                title="Apagar tarefa"
                className="text-neutral-400 hover:text-red-500 transition-colors p-1"
              >
                <TrashIcon />
              </button>
              <button
                onClick={() => setIsEditing((prev) => !prev)}
                aria-label={isEditing ? 'Cancelar edição' : 'Editar tarefa'}
                title={isEditing ? 'Cancelar edição' : 'Editar tarefa'}
                className="text-neutral-400 hover:text-white transition-colors p-1"
              >
                {isEditing ? <XIcon /> : <PencilIcon />}
              </button>
            </div>
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