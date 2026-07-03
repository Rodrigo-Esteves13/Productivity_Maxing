import { useEffect, useState } from 'react';
import PageLayout from '../components/Layout/PageLayout';
import PageHeader from '../components/Layout/PageHeader';
import TaskCard from '../components/Tasks/TaskCard';
import Modal from '../components/UI/Modal';
import TaskForm from '../components/Tasks/TaskForm';
import { getUserTasks, getUserAreas, createTask, getTaskMetadata } from '../api/userService'; 
import type { Task, Area } from '../types/models';

export default function Tasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  
  // Novos estados para os metadados dinâmicos
  const [taskTypes, setTaskTypes] = useState<string[]>([]);
  const [difficulties, setDifficulties] = useState<string[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

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
    setIsModalOpen(false);
    fetchData(); 
  };

  return (
    <PageLayout>
      <PageHeader 
        title="As Minhas Tarefas" 
        description="Gere, filtra e acompanha o progresso de todas as tuas tarefas." 
      />

      <div className="mb-6 flex gap-4">
        <button 
          onClick={() => setIsModalOpen(true)}
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
          {tasks.map(task => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>
      )}

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title="Criar Nova Tarefa"
      >
        <TaskForm 
          onSubmit={handleCreateTask} 
          onCancel={() => setIsModalOpen(false)} 
          areas={areas}
          taskTypes={taskTypes}
          difficulties={difficulties}
        />
      </Modal>
    </PageLayout>
  );
}