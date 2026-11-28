import type { DashboardFiltersState } from '../components/Dashboard/dashboardFilters.types';
import type { Task } from '../types/models';
import { isTaskArchived } from '../utils/taskArchive';
import { getDateStatus } from '../utils/taskDateStatus';
import { isExamTask } from './examMode';
import { matchesEffortFilter, matchesReadinessFilter } from './taskReadinessFilter';

interface DashboardFilterOptions {
  showArchived: boolean;
  isExamMode: boolean;
}

// As tasks academicas que passam nos filtros da tabela do Dashboard.
export function filterDashboardTasks(
  tasks: Task[],
  filters: DashboardFiltersState,
  { showArchived, isExamMode }: DashboardFilterOptions,
): Task[] {
  const search = filters.search.trim().toLowerCase();
  return tasks.filter((task) => {
    if (!showArchived && isTaskArchived(task)) return false;
    if (isExamMode && !isExamTask(task)) return false;
    if (search && !task.title.toLowerCase().includes(search)) return false;
    if (filters.areaId && task.areaId !== filters.areaId) return false;
    if (filters.academicType && task.academicType !== filters.academicType) return false;
    if (filters.difficulty && task.difficulty !== filters.difficulty) return false;
    if (filters.progressStatus && task.progressStatus !== filters.progressStatus) return false;
    if (filters.dateStatus && getDateStatus(task) !== filters.dateStatus) return false;
    if (!matchesEffortFilter(task, filters.effort)) return false;
    if (!matchesReadinessFilter(task, filters.readiness)) return false;
    if (filters.tag && !task.tags?.includes(filters.tag)) return false;
    return true;
  });
}

// Mensagem da tabela vazia: sem tasks nenhumas, so sem exames (modo exame)
// ou nenhuma a passar nos filtros.
export function emptyMessageKey(academicTaskCount: number, isExamMode: boolean): string {
  if (academicTaskCount === 0) return 'ui.youHaveNoAcademicTasks';
  if (isExamMode) return 'examMode.noExamsInTable';
  return 'ui.noTasksMatchTheCurrent';
}
