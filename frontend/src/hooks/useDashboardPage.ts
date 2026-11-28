import { useMemo, useState } from 'react';
import { EMPTY_DASHBOARD_FILTERS, type DashboardFiltersState } from '../components/Dashboard/dashboardFilters.types';
import type { DashboardData } from '../context/dashboard-data-context';
import type { PlanModeContextValue } from '../context/plan-mode-context';
import { useAcademic } from '../context/useAcademic';
import { ACADEMIC_TASK_TYPE_KEY } from '../lib/constants';
import { filterDashboardTasks } from '../lib/dashboardTaskFilter';
import { examModeVisibility } from '../lib/examMode';
import { applyPlanToComponents, applyPlanToTasks, buildPlanFill } from '../lib/planScenario';
import { collectTags } from '../lib/taskTags';
import type { TasksTableColumnId } from '../lib/tasksTableColumns';
import { isTaskArchived } from '../utils/taskArchive';
import { sortTasks } from '../utils/taskSorting';
import { useCompleteWithUndo } from './useCompleteWithUndo';
import { useDashboardData } from './useDashboardData';
import { useDashboardWidgetOrder } from './useDashboardWidgetOrder';
import { useDashboardWidgetPrefs } from './useDashboardWidgetPrefs';
import { useExamMode } from './useExamMode';
import { useOnOffSearchParam } from './useOnOffSearchParam';
import { usePeriodGradeComponents } from './usePeriodGradeComponents';
import { usePlanModePref } from './usePlanMode';
import { useQuickReschedule } from './useQuickReschedule';
import { useShowArchivedTasks } from './useShowArchivedTasks';
import { useSingleTaskMode } from './useSingleTaskMode';
import { useTableDensity } from './useTableDensity';
import { useTableSort } from './useTableSort';
import { useTaskSelection } from './useTaskSelection';

// Nomes dos parametros ?exam= / ?plan= / ?single= (paleta Ctrl+K).
const EXAM_MODE_PARAM = 'exam';
const PLAN_MODE_PARAM = 'plan';
const SINGLE_TASK_PARAM = 'single';

// Estado e dados derivados do Dashboard; a pagina so trata de layout.
export function useDashboardPage() {
  const [filters, setFilters] = useState<DashboardFiltersState>(EMPTY_DASHBOARD_FILTERS);
  const tableSort = useTableSort<TasksTableColumnId>();
  const { sort } = tableSort;

  // O Dashboard segue sempre o periodo escolhido no topo da pagina
  // (PeriodSelector): mudar de periodo = novo fetch. "Sem programa" tambem
  // cai no 'all' do backend, que ja devolve tarefas de todos os programas.
  const { activeProgram, activePeriod, isViewingAllPeriods, isViewingAllPrograms, isLoading: isAcademicLoading } = useAcademic();
  const periodParam = isViewingAllPeriods || isViewingAllPrograms ? 'all' : activePeriod?.id;

  const data = useDashboardData(periodParam, isAcademicLoading);
  const { tasks, setTasks, areas, academicTaskTypes, dataPeriod } = data;

  const { rescheduleToTomorrow, reschedulingId } = useQuickReschedule((updatedTask) => {
    setTasks((prev) => prev.map((t) => (t.id === updatedTask.id ? updatedTask : t)));
  });

  const widgets = useDashboardWidgetPrefs();
  const widgetOrder = useDashboardWidgetOrder();
  const tableDensity = useTableDensity();
  const { showArchived, toggleShowArchived } = useShowArchivedTasks();
  const { isExamMode, setIsExamMode } = useExamMode();
  const { isSingleTaskMode, setIsSingleTaskMode } = useSingleTaskMode();
  const { isPlanMode, setIsPlanMode } = usePlanModePref();
  useOnOffSearchParam(SINGLE_TASK_PARAM, setIsSingleTaskMode);
  useOnOffSearchParam(PLAN_MODE_PARAM, setIsPlanMode);
  useOnOffSearchParam(EXAM_MODE_PARAM, setIsExamMode);

  // Em modo exame os cartoes ficam escondidos sem mexer nas preferencias
  // de cada um: ao sair do modo volta tudo como estava.
  const cardVisibility = useMemo(
    () => (isExamMode ? examModeVisibility(widgets.visibility) : widgets.visibility),
    [isExamMode, widgets.visibility],
  );

  const academicTasks = useMemo(
    () => tasks.filter((task) => task.type === ACADEMIC_TASK_TYPE_KEY),
    [tasks],
  );

  // Modo plano: os cartoes veem as notas "se tudo correr como planeado"
  // (alvos + medianas, ver lib/planScenario.ts). A tabela e as acoes usam
  // SEMPRE as tasks reais, para nunca se gravar uma nota inventada.
  // Fora do PlanModeContext, este hook devolve os componentes reais.
  const realComponents = usePeriodGradeComponents();
  const planFill = useMemo(() => buildPlanFill(academicTasks, realComponents), [academicTasks, realComponents]);
  const cardTasks = useMemo(
    () => (isPlanMode ? applyPlanToTasks(academicTasks, planFill) : academicTasks),
    [isPlanMode, academicTasks, planFill],
  );
  const planModeValue = useMemo<PlanModeContextValue>(
    () => ({
      isPlanMode,
      planComponents: isPlanMode ? (components) => applyPlanToComponents(components, planFill) : (components) => components,
    }),
    [isPlanMode, planFill],
  );

  const academicAreas = useMemo(() => {
    const areaIdsWithAcademicTasks = new Set(academicTasks.map((task) => task.areaId));
    return areas.filter((area) => areaIdsWithAcademicTasks.has(area.id));
  }, [areas, academicTasks]);

  const gradeScale = activeProgram?.gradeScale ?? '';
  const cardData = useMemo<DashboardData>(
    () => ({ academicTasks: cardTasks, allTasks: tasks, academicAreas, academicTaskTypes, gradeScale }),
    [cardTasks, tasks, academicAreas, academicTaskTypes, gradeScale],
  );

  const allTags = useMemo(() => collectTags(academicTasks), [academicTasks]);

  const archivedCount = useMemo(
    () => academicTasks.filter((task) => isTaskArchived(task)).length,
    [academicTasks],
  );

  // Sem coluna escolhida ordena por prazo (TBD/Surprise no fim). A ordem
  // do servidor e a manual da pagina Tasks (arrastar), que aqui so
  // baralhava as datas.
  const filteredTasks = useMemo(
    () =>
      sortTasks(
        filterDashboardTasks(academicTasks, filters, { showArchived, isExamMode }),
        sort?.key ?? 'date',
        sort?.direction ?? 'asc',
      ),
    [academicTasks, filters, showArchived, isExamMode, sort],
  );

  // A selecao cai quando mudam os filtros ou o periodo: nunca se apaga nem se
  // altera uma task que ja nao esta a vista.
  const selectionKey = useMemo(() => ({ filters, periodParam }), [filters, periodParam]);
  const selection = useTaskSelection(filteredTasks, setTasks, selectionKey);
  const { completeOne } = useCompleteWithUndo(setTasks);

  // Periodo, filtros e ordem: quando mudam, a tabela volta ao primeiro bloco.
  const listResetKey = JSON.stringify([dataPeriod, filters, sort, showArchived, isExamMode]);

  return {
    ...data,
    activeProgram,
    activePeriod,
    isViewingAllPeriods,
    filters,
    setFilters,
    tableSort,
    rescheduleToTomorrow,
    reschedulingId,
    completeOne,
    widgets,
    widgetOrder,
    tableDensity,
    showArchived,
    toggleShowArchived,
    isExamMode,
    setIsExamMode,
    isSingleTaskMode,
    setIsSingleTaskMode,
    isPlanMode,
    setIsPlanMode,
    cardVisibility,
    academicTasks,
    cardTasks,
    planModeValue,
    cardData,
    academicAreas,
    allTags,
    archivedCount,
    filteredTasks,
    selection,
    listResetKey,
  };
}

export type DashboardPageState = ReturnType<typeof useDashboardPage>;
