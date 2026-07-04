import { useEffect, useState } from 'react';
import PageLayout from '../components/Layout/PageLayout';
import PageHeader from '../components/Layout/PageHeader';
import LoadingState from '../components/UI/LoadingState';
import TasksTable from '../components/Dashboard/TasksTable';
import { getUserTasks } from '../api/userService';
import type { Task } from '../types/models';

export default function Dashboard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const data = await getUserTasks();
        setTasks(data);
      } catch (err) {
        console.error('Erro ao carregar dashboard', err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  return (
    <PageLayout>
      <PageHeader
        title="Dashboard Analítica"
        description="Visão global de todas as tuas atividades, notas e progressos."
      />

      {isLoading ? (
        <LoadingState message="A compilar dados..." />
      ) : (
        <TasksTable tasks={tasks} />
      )}
    </PageLayout>
  );
}
