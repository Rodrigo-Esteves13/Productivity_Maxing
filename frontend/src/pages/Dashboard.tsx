import { useEffect, useState } from 'react';
import PageLayout from '../components/Layout/PageLayout';
import PageHeader from '../components/Layout/PageHeader';
import TaskCard from '../components/Tasks/TaskCard';
import { getUserTasks } from '../api/userService';
import type { Task } from '../types/models';

export default function Dashboard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTasks() {
      try {
        const data = await getUserTasks();
        setTasks(data);
      } catch (err) {
        setError('Não foi possível carregar as tarefas.');
      } finally {
        setIsLoading(false);
      }
    }
    fetchTasks();
  }, []);

  return (
    <PageLayout>
      <PageHeader 
        title="Dashboard" 
        description="Visão geral das tuas tarefas, projetos e áreas de vida." 
      />

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <p className="text-neutral-400 animate-pulse">A carregar tarefas...</p>
        </div>
      ) : error ? (
        <div className="p-4 bg-red-900/50 border border-red-500 rounded-lg text-red-200">
          {error}
        </div>
      ) : tasks.length === 0 ? (
        <div className="p-8 text-center bg-neutral-900/50 border border-neutral-800 rounded-xl">
          <p className="text-neutral-400">Não tens tarefas pendentes.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {tasks.map(task => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>
      )}
    </PageLayout>
  );
}