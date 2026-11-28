import { useCallback, useEffect, useState } from 'react';
import { getTaskMetadata } from '../api/metadataService';
import { getUserAreas } from '../api/areasService';
import type { AcademicTaskTypeOption, Area, PriorityOption, TaskTypeOption } from '../types/models';

interface TaskCatalog {
  areas: Area[];
  taskTypes: TaskTypeOption[];
  academicTaskTypes: AcademicTaskTypeOption[];
  difficulties: string[];
  priorities: PriorityOption[];
  progressStatuses: string[];
}

const EMPTY_CATALOG: TaskCatalog = {
  areas: [],
  taskTypes: [],
  academicTaskTypes: [],
  difficulties: [],
  priorities: [],
  progressStatuses: [],
};

// Areas e metadados das tasks (Dashboard e pagina Tasks). Nao dependem do
// periodo academico, por isso arrancam logo no mount, em paralelo com a cadeia
// AuthContext -> AcademicContext. A cache vive nos servicos (catalogCache.ts).
export function useTaskCatalog() {
  const [catalog, setCatalog] = useState<TaskCatalog>(EMPTY_CATALOG);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let isCurrent = true;
    async function load() {
      try {
        const [areas, meta] = await Promise.all([getUserAreas(), getTaskMetadata()]);
        if (!isCurrent) return;
        setCatalog({
          areas,
          taskTypes: meta.taskTypes,
          academicTaskTypes: meta.academicTaskTypes,
          difficulties: meta.difficulties,
          // `?? []`: um backend sem a Priority (deploy a meio) manda undefined,
          // e o `.includes()` em DifficultyTypeFields rebentava.
          priorities: meta.priorities ?? [],
          progressStatuses: meta.progressStatuses,
        });
      } catch (error) {
        if (!isCurrent) return;
        console.error('Failed to load task metadata', error);
        setHasError(true);
      }
      setIsLoading(false);
    }
    void load();
    return () => {
      isCurrent = false;
    };
  }, [attempt]);

  // Tentar outra vez depois de um erro de carregamento.
  const reload = useCallback(() => {
    setHasError(false);
    setIsLoading(true);
    setAttempt((n) => n + 1);
  }, []);

  return { ...catalog, isLoading, hasError, reload };
}
