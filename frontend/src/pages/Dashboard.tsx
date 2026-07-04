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
        title="Analytics Dashboard"
        description="Global view of all your activities, grades, and progress."
      />

      {isLoading ? (
        <LoadingState message="Compiling data..." />
      ) : (
        <TasksTable tasks={tasks} />
      )}
    </PageLayout>
  );
}
