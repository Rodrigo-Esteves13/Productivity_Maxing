import { useEffect, useMemo, useState } from 'react';
import PageLayout from '../components/Layout/PageLayout';
import PageHeader from '../components/Layout/PageHeader';
import LoadingState from '../components/UI/LoadingState';
import ErrorState from '../components/UI/ErrorState';
import EmptyState from '../components/UI/EmptyState';
import TasksTable from '../components/Dashboard/TasksTable';
import DashboardFilters from '../components/Dashboard/DashboardFilters';
import { EMPTY_DASHBOARD_FILTERS, type DashboardFiltersState } from '../components/Dashboard/dashboardFilters.types';
import { getUserTasks, getUserAreas, getTaskMetadata } from '../api/userService';
import { getDateStatus } from '../utils/taskDateStatus';
import type { Task, Area, AcademicTaskTypeOption } from '../types/models';
import useDocumentTitle from '../hooks/useDocumentTitle';

// Esta página é o "Analytics Dashboard" - notas, pesos, target vs real
// grade. Isso só faz sentido para tasks Académicas (um hábito como
// "Natação" nunca vai ter nota nem peso), por isso o âmbito é fixo aqui,
// não é mais um filtro que o utilizador escolhe. Para ver tudo (hábitos,
// eventos, projetos, etc.), a página "Tasks" continua a mostrar tudo.
const DASHBOARD_TASK_TYPE_KEY = 'ACADEMICO';

export default function Dashboard() {
  useDocumentTitle('Dashboard');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [academicTaskTypes, setAcademicTaskTypes] = useState<AcademicTaskTypeOption[]>([]);
  const [difficulties, setDifficulties] = useState<string[]>([]);
  const [progressStatuses, setProgressStatuses] = useState<string[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<DashboardFiltersState>(EMPTY_DASHBOARD_FILTERS);

  useEffect(() => {
    async function fetchData() {
      try {
        const [tasksData, areasData, metaData] = await Promise.all([
          getUserTasks(),
          getUserAreas(),
          getTaskMetadata(),
        ]);
        setTasks(tasksData);
        setAreas(areasData);
        setAcademicTaskTypes(metaData.academicTaskTypes);
        setDifficulties(metaData.difficulties);
        setProgressStatuses(metaData.progressStatuses);
      } catch (err) {
        console.error('Erro ao carregar dashboard', err);
        setError('Could not load the dashboard data.');
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  // Âmbito base: só tasks Académicas entram sequer em consideração antes
  // de qualquer filtro do utilizador.
  const academicTasks = useMemo(
    () => tasks.filter((task) => task.type === DASHBOARD_TASK_TYPE_KEY),
    [tasks],
  );

  // Só Areas que efetivamente têm tasks Académicas aparecem no filtro de
  // Area - listar "Natação" aqui (uma Area de Hábito) não fazia sentido
  // nenhum numa vista de notas.
  const academicAreas = useMemo(() => {
    const areaIdsWithAcademicTasks = new Set(academicTasks.map((task) => task.areaId));
    return areas.filter((area) => areaIdsWithAcademicTasks.has(area.id));
  }, [areas, academicTasks]);

  const filteredTasks = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    return academicTasks.filter((task) => {
      if (search && !task.title.toLowerCase().includes(search)) return false;
      if (filters.areaId && task.areaId !== filters.areaId) return false;
      if (filters.academicType && task.academicType !== filters.academicType) return false;
      if (filters.difficulty && task.difficulty !== filters.difficulty) return false;
      if (filters.progressStatus && task.progressStatus !== filters.progressStatus) return false;
      if (filters.dateStatus && getDateStatus(task) !== filters.dateStatus) return false;
      return true;
    });
  }, [academicTasks, filters]);

  return (
    <PageLayout>
      <PageHeader
        title="Analytics Dashboard"
        description="Global view of all your academic activities, grades, and progress."
      />

      {isLoading ? (
        <LoadingState message="Compiling data..." className="h-64" />
      ) : error ? (
        <ErrorState message={error} />
      ) : (
        <>
          <DashboardFilters
            filters={filters}
            onChange={setFilters}
            areas={academicAreas}
            academicTaskTypes={academicTaskTypes}
            difficulties={difficulties}
            progressStatuses={progressStatuses}
            onClear={() => setFilters(EMPTY_DASHBOARD_FILTERS)}
          />

          {filteredTasks.length === 0 ? (
            <EmptyState
              message={
                academicTasks.length === 0
                  ? 'You have no academic tasks registered.'
                  : 'No tasks match the current filters.'
              }
            />
          ) : (
            <TasksTable tasks={filteredTasks} academicTaskTypes={academicTaskTypes} />
          )}
        </>
      )}
    </PageLayout>
  );
}
