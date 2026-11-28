import { useCallback } from 'react';
import { useQuickReschedule } from './useQuickReschedule';
import { usePeriodTasks } from './usePeriodTasks';
import { useTaskCatalog } from './useTaskCatalog';
import { useTaskCrud } from './useTaskCrud';
import { useTaskDetail } from './useTaskDetail';
import { useTaskListActions } from './useTaskListActions';
import { useTaskReplan } from './useTaskReplan';
import { useAcademic } from '../context/useAcademic';
import { translateNow } from '../i18n/translate';

// Estado e acoes da pagina Tasks: junta os hooks de cada assunto.
export function useTasksPage() {
  // Segue sempre o período selecionado no topo da página (PeriodSelector).
  // "No program" (isViewingAllPrograms) também cai no 'all' do backend -
  // esse filtro já não tem qualquer restrição de periodId, logo já
  // devolve as tasks de todos os programas, não só do período ativo.
  const { activePeriod, isViewingAllPeriods, isViewingAllPrograms, isLoading: isAcademicLoading } = useAcademic();
  const periodParam = isViewingAllPeriods || isViewingAllPrograms ? 'all' : activePeriod?.id;

  const catalog = useTaskCatalog();
  const period = usePeriodTasks(periodParam, isAcademicLoading);
  const { tasks, setTasks, isStale, refreshTasks } = period;

  const { rescheduleToTomorrow, reschedulingId } = useQuickReschedule((updatedTask) => {
    setTasks((prev) => prev.map((t) => (t.id === updatedTask.id ? updatedTask : t)));
  });

  const { setSelectedTask, setIsEditing, ...detail } = useTaskDetail(tasks, setTasks, isStale);
  const crud = useTaskCrud({
    setTasks,
    taskTypes: catalog.taskTypes,
    selectedTask: detail.selectedTask,
    setSelectedTask,
    setIsEditing,
    closeDetailModal: detail.closeDetailModal,
  });
  const actions = useTaskListActions({
    tasks,
    setTasks,
    selectedTask: detail.selectedTask,
    setSelectedTask,
  });
  const { replanTasks, replanError, clearReplanError } = useTaskReplan(setTasks, refreshTasks);

  const loadError = catalog.hasError || period.hasError ? translateNow('hook.couldNotLoadTheData') : null;

  // Tentar outra vez depois de um erro de carregamento.
  const reloadCatalog = catalog.reload;
  const reloadTasks = period.reload;
  const reload = useCallback(() => {
    clearReplanError();
    reloadCatalog();
    reloadTasks();
  }, [clearReplanError, reloadCatalog, reloadTasks]);

  return {
    tasks,
    replanTasks,
    areas: catalog.areas,
    taskTypes: catalog.taskTypes,
    academicTaskTypes: catalog.academicTaskTypes,
    difficulties: catalog.difficulties,
    priorities: catalog.priorities,
    progressStatuses: catalog.progressStatuses,
    isLoading: period.isLoading || catalog.isLoading,
    // As tasks no ecra sao do periodo anterior (o novo esta a chegar).
    isStale,
    dataPeriod: period.dataPeriod,
    error: replanError ?? loadError,
    reload,
    rescheduleToTomorrow,
    reschedulingId,
    ...detail,
    ...crud,
    ...actions,
  };
}
