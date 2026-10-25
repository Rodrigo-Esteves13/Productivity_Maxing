import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import PageLayout from '../components/Layout/PageLayout';
import PageHeader from '../components/Layout/PageHeader';
import ErrorState from '../components/UI/ErrorState';
import EmptyState from '../components/UI/EmptyState';
import TasksTable from '../components/Dashboard/TasksTable';
import TasksTableSkeleton from '../components/Dashboard/TasksTableSkeleton';
import DashboardFilters from '../components/Dashboard/DashboardFilters';
import { EMPTY_DASHBOARD_FILTERS, type DashboardFiltersState } from '../components/Dashboard/dashboardFilters.types';
import { getDateStatus } from '../utils/taskDateStatus';
import { sortTasks } from '../utils/taskSorting';
import { useTableSort } from '../hooks/useTableSort';
import type { TasksTableColumnId } from '../lib/tasksTableColumns';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { useQuickReschedule } from '../hooks/useQuickReschedule';
import { useDashboardData } from '../hooks/useDashboardData';
import { useTaskSelection } from '../hooks/useTaskSelection';
import { useCompleteWithUndo } from '../hooks/useCompleteWithUndo';
import { useAcademic } from '../context/useAcademic';
import GpaSummary from '../components/Dashboard/GpaSummary';
import PeriodProgressBar from '../components/Dashboard/PeriodProgressBar';
import OverloadAlertCard from '../components/Dashboard/OverloadAlertCard';
import MissingGradeCard from '../components/Dashboard/MissingGradeCard';
import OnboardingChecklist from '../components/Dashboard/OnboardingChecklist';
import DashboardCardGrid from '../components/Dashboard/DashboardCardGrid';
import {
  GradeNeededCalculator,
  TaskImportModal,
} from '../components/Dashboard/lazyCards';
import ProgramsOverviewCard from '../components/Dashboard/ProgramsOverviewCard';
import CreditsAccumulatedCard from '../components/Dashboard/CreditsAccumulatedCard';
import { DashboardWidgetToggles } from '../components/Dashboard/DashboardWidgetToggles';
import { useDashboardWidgetPrefs } from '../hooks/useDashboardWidgetPrefs';
import { useTableDensity } from '../hooks/useTableDensity';
import { useShowArchivedTasks } from '../hooks/useShowArchivedTasks';
import { isTaskArchived } from '../utils/taskArchive';
import { PrinterIcon, UploadIcon, SlidersIcon, GraduationCapIcon } from '../components/UI/Icons';
import BulkActionsBar from '../components/Dashboard/BulkActionsBar';
import TaskExportButtons from '../components/Dashboard/TaskExportButtons';
import { ACADEMIC_TASK_TYPE_KEY } from '../lib/constants';
import { useExamMode } from '../hooks/useExamMode';
import { examModeVisibility, isExamTask } from '../lib/examMode';
import ExamModePanel from '../components/Dashboard/ExamModePanel';
import InstallAppCard from '../pwa/InstallAppCard';
import { useI18n } from '../i18n/useI18n';
import ToolbarButton from '../components/UI/ToolbarButton';

// Mensagem da tabela vazia: sem tasks nenhumas, so sem exames (modo exame)
// ou nenhuma a passar nos filtros.
function emptyMessageKey(academicTaskCount: number, isExamMode: boolean): string {
  if (academicTaskCount === 0) return 'ui.youHaveNoAcademicTasks';
  if (isExamMode) return 'examMode.noExamsInTable';
  return 'ui.noTasksMatchTheCurrent';
}

// ?exam=on / ?exam=off (paleta Ctrl+K) liga ou desliga o modo exame.
const EXAM_MODE_PARAM = 'exam';
const EXAM_MODE_OFF = 'off';

export default function Dashboard() {
  const { t } = useI18n();
  useDocumentTitle('Dashboard');
  const [filters, setFilters] = useState<DashboardFiltersState>(EMPTY_DASHBOARD_FILTERS);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const { sort, toggleKey, setKey, toggleDirection } = useTableSort<TasksTableColumnId>();

  // O Dashboard segue sempre o periodo escolhido no topo da pagina
  // (PeriodSelector): mudar de periodo = novo fetch. "Sem programa" tambem
  // cai no 'all' do backend, que ja devolve tarefas de todos os programas.
  const { activeProgram, activePeriod, isViewingAllPeriods, isViewingAllPrograms, isLoading: isAcademicLoading } = useAcademic();
  const periodParam = isViewingAllPeriods || isViewingAllPrograms ? 'all' : activePeriod?.id;

  const {
    tasks, setTasks, areas, academicTaskTypes, difficulties, progressStatuses,
    isLoading, error, refreshTasks,
  } = useDashboardData(periodParam, isAcademicLoading);

  const { rescheduleToTomorrow, reschedulingId } = useQuickReschedule((updatedTask) => {
    setTasks((prev) => prev.map((t) => (t.id === updatedTask.id ? updatedTask : t)));
  });

  const { visibility, toggle } = useDashboardWidgetPrefs();
  const { density, toggleDensity } = useTableDensity();
  const { showArchived, toggleShowArchived } = useShowArchivedTasks();
  const { isExamMode, setIsExamMode } = useExamMode();
  // Em modo exame os cartoes ficam escondidos sem mexer nas preferencias
  // de cada um: ao sair do modo volta tudo como estava.
  const cardVisibility = useMemo(
    () => (isExamMode ? examModeVisibility(visibility) : visibility),
    [isExamMode, visibility],
  );

  const [searchParams, setSearchParams] = useSearchParams();
  const examParam = searchParams.get(EXAM_MODE_PARAM);
  useEffect(() => {
    if (examParam === null) return;
    setIsExamMode(examParam !== EXAM_MODE_OFF);
    setSearchParams(
      (params) => {
        params.delete(EXAM_MODE_PARAM);
        return params;
      },
      { replace: true },
    );
  }, [examParam, setIsExamMode, setSearchParams]);

  const academicTasks = useMemo(
    () => tasks.filter((task) => task.type === ACADEMIC_TASK_TYPE_KEY),
    [tasks],
  );

  const academicAreas = useMemo(() => {
    const areaIdsWithAcademicTasks = new Set(academicTasks.map((task) => task.areaId));
    return areas.filter((area) => areaIdsWithAcademicTasks.has(area.id));
  }, [areas, academicTasks]);

  const archivedCount = useMemo(
    () => academicTasks.filter((task) => isTaskArchived(task)).length,
    [academicTasks],
  );

  const filteredTasks = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    const matching = academicTasks.filter((task) => {
      if (!showArchived && isTaskArchived(task)) return false;
      if (isExamMode && !isExamTask(task)) return false;
      if (search && !task.title.toLowerCase().includes(search)) return false;
      if (filters.areaId && task.areaId !== filters.areaId) return false;
      if (filters.academicType && task.academicType !== filters.academicType) return false;
      if (filters.difficulty && task.difficulty !== filters.difficulty) return false;
      if (filters.progressStatus && task.progressStatus !== filters.progressStatus) return false;
      if (filters.dateStatus && getDateStatus(task) !== filters.dateStatus) return false;
      return true;
    });
    // Sem coluna escolhida mantem a ordem original do servidor.
    return sort ? sortTasks(matching, sort.key, sort.direction) : matching;
  }, [academicTasks, filters, showArchived, isExamMode, sort]);

  const {
    selectedIds, toggleSelect, toggleSelectAll, markSelectedDone, rescheduleSelected, deleteSelected,
    selectedSyncedCount, clearSelection,
  } = useTaskSelection(filteredTasks, setTasks, filters);
  const { completeOne } = useCompleteWithUndo(setTasks);

  return (
    <PageLayout>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title={t('ui.analyticsDashboard')}
          description={t('ui.globalViewOfAllYour')}
        />
        <div className="print-hide flex flex-wrap items-center gap-x-1 gap-y-2">
          <ToolbarButton
            tone="muted"
            size="md"
            onClick={() => setIsImportModalOpen(true)}
          >
            <UploadIcon />
            {t('ui.import')}
          </ToolbarButton>
          <TaskExportButtons tasks={filteredTasks} areas={academicAreas} academicTaskTypes={academicTaskTypes} />
          <ToolbarButton
            tone="muted"
            size="md"
            onClick={() => window.print()}
          >
            <PrinterIcon />
            {t('ui.print')}
          </ToolbarButton>
          <ToolbarButton
            tone="muted"
            size="md"
            pressed={isExamMode}
            onClick={() => setIsExamMode((prev) => !prev)}
            title={t('examMode.toggleHelp')}
          >
            <GraduationCapIcon />
            {t('examMode.toggle')}
          </ToolbarButton>
          <ToolbarButton
            tone="muted"
            size="md"
            onClick={toggleDensity}
            title={t('ui.toggleTableRowDensity')}
          >
            <SlidersIcon />
            {density === 'compact' ? t('ui.comfortable') : t('ui.compact')}
          </ToolbarButton>
          {archivedCount > 0 && (
            <label className="flex items-center gap-1.5 text-sm text-neutral-400 select-none cursor-pointer">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={toggleShowArchived}
                className="accent-violet-500"
              />
              {t('ui.showArchivedCount', { count: archivedCount })}
            </label>
          )}
          <DashboardWidgetToggles visibility={visibility} toggle={toggle} />
        </div>
      </div>

      <InstallAppCard />

      {isExamMode && !isLoading && !error && (
        <ExamModePanel tasks={academicTasks} areas={academicAreas} onTurnOff={() => setIsExamMode(false)} />
      )}

      {!isExamMode && <GpaSummary showCreditSimulator={visibility.creditSimulator} />}

      {cardVisibility.creditsAccumulated && <CreditsAccumulatedCard />}

      {cardVisibility.programsOverview && <ProgramsOverviewCard />}

      {cardVisibility.periodProgress && !isLoading && !error && !isViewingAllPeriods && activePeriod && (
        <PeriodProgressBar period={activePeriod} tasks={academicTasks} />
      )}

      {!isExamMode && !isLoading && !error && <OnboardingChecklist taskCount={tasks.length} />}

      {cardVisibility.missingGrade && !isLoading && !error && academicAreas.length > 0 && (
        <MissingGradeCard areas={academicAreas} refreshKey={tasks.reduce((sum, task) => sum + (task.weightPercentage ?? 0), tasks.length)} />
      )}

      {cardVisibility.overloadAlert && !isLoading && !error && academicTasks.length > 0 && (
        <OverloadAlertCard tasks={academicTasks} areas={academicAreas} />
      )}

      {/*
        Masonry em JS (MasonryGrid): cada cartão vai para a coluna mais
        curta e o último de cada coluna estica até ao fundo, por isso as
        duas colunas acabam sempre à mesma altura, tenha o Dashboard 3 ou
        14 cartões visíveis. Um cartão sem dados (renderiza null) não
        ocupa lugar. Com CSS multi-column isto não era possível: não há
        forma de esticar o último item de cada coluna.
      */}
      {!isLoading && !error && (
        <DashboardCardGrid
          academicTasks={academicTasks}
          academicAreas={academicAreas}
          academicTaskTypes={academicTaskTypes}
          activeProgram={activeProgram}
          visibility={cardVisibility}
        />
      )}

      {cardVisibility.gradeCalculator && !isLoading && !error && academicAreas.length > 0 && activeProgram && (
        <div className="mb-6">
          <Suspense fallback={null}>
            <GradeNeededCalculator
              tasks={academicTasks}
              areas={academicAreas}
              scale={activeProgram.gradeScale}
            />
          </Suspense>
        </div>
      )}

      {isLoading ? (
        <TasksTableSkeleton />
      ) : error ? (
        <ErrorState message={error} />
      ) : (
        <>
          <div className="print-hide">
            <DashboardFilters
              filters={filters}
              onChange={setFilters}
              areas={academicAreas}
              academicTaskTypes={academicTaskTypes}
              difficulties={difficulties}
              progressStatuses={progressStatuses}
              onClear={() => setFilters(EMPTY_DASHBOARD_FILTERS)}
              sort={sort}
              onSortKeyChange={setKey}
              onToggleSortDirection={toggleDirection}
            />
          </div>

          {filteredTasks.length === 0 ? (
            <EmptyState message={t(emptyMessageKey(academicTasks.length, isExamMode))} />
          ) : (
            <>
              <BulkActionsBar
                selectedCount={selectedIds.size}
                onMarkDone={markSelectedDone}
                onReschedule={rescheduleSelected}
                onDelete={deleteSelected}
                syncedCount={selectedSyncedCount}
                onClear={clearSelection}
              />
              <TasksTable
                tasks={filteredTasks}
                academicTaskTypes={academicTaskTypes}
                onReschedule={rescheduleToTomorrow}
                onComplete={completeOne}
                reschedulingId={reschedulingId}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
                onToggleSelectAll={toggleSelectAll}
                density={density}
                sort={sort}
                onSortColumn={toggleKey}
              />
            </>
          )}
        </>
      )}

      {isImportModalOpen && (
        <Suspense fallback={null}>
          <TaskImportModal
            isOpen={isImportModalOpen}
            onClose={() => setIsImportModalOpen(false)}
            onImported={refreshTasks}
          />
        </Suspense>
      )}
    </PageLayout>
  );
}