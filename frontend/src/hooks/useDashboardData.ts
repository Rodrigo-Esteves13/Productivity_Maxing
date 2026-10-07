import { useCallback, useEffect, useState } from 'react';
import { getTaskMetadata, getUserAreas, getUserTasks } from '../api/userService';
import type { AcademicTaskTypeOption, Area, Task } from '../types/models';
import { isRequestCanceled } from '../lib/abortable';

const LOAD_ERROR_MESSAGE = 'Could not load the dashboard data.';

// Tudo o que o Dashboard vai buscar ao servidor: tarefas do periodo,
// areas e metadados (tipos, dificuldades, estados). Fica fora da pagina
// para a pagina so tratar de layout.
export function useDashboardData(periodParam: string | undefined, isAcademicLoading: boolean) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [academicTaskTypes, setAcademicTaskTypes] = useState<AcademicTaskTypeOption[]>([]);
  const [difficulties, setDifficulties] = useState<string[]>([]);
  const [progressStatuses, setProgressStatuses] = useState<string[]>([]);
  const [isTasksLoading, setIsTasksLoading] = useState(true);
  const [isMetaLoading, setIsMetaLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Areas e metadados sao um catalogo global (nao dependem do periodo
  // academico), por isso arrancam logo no mount, em paralelo com a cadeia
  // AuthContext -> AcademicContext, em vez de esperarem por ela.
  useEffect(() => {
    async function fetchMeta() {
      try {
        setIsMetaLoading(true);
        const [areasData, metaData] = await Promise.all([getUserAreas(), getTaskMetadata()]);
        setAreas(areasData);
        setAcademicTaskTypes(metaData.academicTaskTypes);
        setDifficulties(metaData.difficulties);
        setProgressStatuses(metaData.progressStatuses);
      } catch (err) {
        console.error('Failed to load dashboard metadata', err);
        setError(LOAD_ERROR_MESSAGE);
      } finally {
        setIsMetaLoading(false);
      }
    }
    void fetchMeta();
  }, []);

  // Enquanto o AcademicContext nao resolve, periodParam e undefined: esperar
  // evita um fetch inutil (e deitado fora) em todas as cargas do Dashboard.
  useEffect(() => {
    if (isAcademicLoading) return;

    // Mudar de periodo cancela o pedido anterior: uma resposta lenta do
    // periodo antigo nunca pode pisar a do periodo novo.
    const controller = new AbortController();
    async function fetchTasks() {
      try {
        setIsTasksLoading(true);
        setTasks(await getUserTasks(periodParam, controller.signal));
        setIsTasksLoading(false);
      } catch (err) {
        if (isRequestCanceled(err)) return;
        console.error('Failed to load dashboard tasks', err);
        setError(LOAD_ERROR_MESSAGE);
        setIsTasksLoading(false);
      }
    }
    void fetchTasks();
    return () => controller.abort();
  }, [periodParam, isAcademicLoading]);

  // Depois de um import: refaz so as tarefas, sem skeleton.
  const refreshTasks = useCallback(async () => {
    try {
      setTasks(await getUserTasks(periodParam));
    } catch (err) {
      console.error('Failed to refresh tasks after import:', err);
    }
  }, [periodParam]);

  return {
    tasks,
    setTasks,
    areas,
    academicTaskTypes,
    difficulties,
    progressStatuses,
    isLoading: isTasksLoading || isMetaLoading,
    error,
    refreshTasks,
  };
}
