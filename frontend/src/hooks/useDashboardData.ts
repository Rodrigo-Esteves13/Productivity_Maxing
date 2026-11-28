import { translateNow } from '../i18n/translate';
import { usePeriodTasks } from './usePeriodTasks';
import { useTaskCatalog } from './useTaskCatalog';

// Tudo o que o Dashboard vai buscar ao servidor: tarefas do periodo,
// areas e metadados (tipos, dificuldades, estados). Fica fora da pagina
// para a pagina so tratar de layout.
export function useDashboardData(periodParam: string | undefined, isAcademicLoading: boolean) {
  const catalog = useTaskCatalog();
  const period = usePeriodTasks(periodParam, isAcademicLoading);

  return {
    tasks: period.tasks,
    setTasks: period.setTasks,
    areas: catalog.areas,
    academicTaskTypes: catalog.academicTaskTypes,
    difficulties: catalog.difficulties,
    progressStatuses: catalog.progressStatuses,
    isLoading: period.isLoading || catalog.isLoading,
    isStale: period.isStale,
    dataPeriod: period.dataPeriod,
    error:
      period.hasError || catalog.hasError ? translateNow('hook.couldNotLoadTheDashboardData') : null,
    refreshTasks: period.refreshTasks,
  };
}
