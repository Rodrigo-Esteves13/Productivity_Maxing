import { Suspense, useMemo, useState } from 'react';
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
import { useAcademic } from '../context/useAcademic';
import GpaSummary from '../components/Dashboard/GpaSummary';
import PeriodProgressBar from '../components/Dashboard/PeriodProgressBar';
import OverloadAlertCard from '../components/Dashboard/OverloadAlertCard';
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
import { PrinterIcon, UploadIcon, SlidersIcon } from '../components/UI/Icons';
import BulkActionsBar from '../components/Dashboard/BulkActionsBar';
import TaskExportButtons from '../components/Dashboard/TaskExportButtons';
import { ACADEMIC_TASK_TYPE_KEY } from '../lib/constants';

export default function Dashboard() {
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
  }, [academicTasks, filters, showArchived, sort]);

  const {
    selectedIds, toggleSelect, toggleSelectAll, markSelectedDone, deleteSelected, clearSelection,
  } = useTaskSelection(filteredTasks, setTasks, filters);

  return (
    <PageLayout>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title="Analytics Dashboard"
          description="Global view of all your academic activities, grades, and progress."
        />
        <div className="print-hide flex items-center gap-4">
          <button
            type="button"
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-1.5 text-sm text-neutral-400 hover:text-neutral-200"
          >
            <UploadIcon />
            Import
          </button>
          <TaskExportButtons tasks={filteredTasks} areas={academicAreas} academicTaskTypes={academicTaskTypes} />
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-1.5 text-sm text-neutral-400 hover:text-neutral-200"
          >
            <PrinterIcon />
            Print
          </button>
          <button
            type="button"
            onClick={toggleDensity}
            title="Toggle table row density"
            className="flex items-center gap-1.5 text-sm text-neutral-400 hover:text-neutral-200"
          >
            <SlidersIcon />
            {density === 'compact' ? 'Comfortable' : 'Compact'}
          </button>
          {archivedCount > 0 && (
            <label className="flex items-center gap-1.5 text-sm text-neutral-400 select-none cursor-pointer">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={toggleShowArchived}
                className="accent-violet-500"
              />
              Show archived ({archivedCount})
            </label>
          )}
          <DashboardWidgetToggles visibility={visibility} toggle={toggle} />
        </div>
      </div>

      <GpaSummary showCreditSimulator={visibility.creditSimulator} />

      {visibility.creditsAccumulated && <CreditsAccumulatedCard />}

      {visibility.programsOverview && <ProgramsOverviewCard />}

      {visibility.periodProgress && !isLoading && !error && !isViewingAllPeriods && activePeriod && (
        <PeriodProgressBar period={activePeriod} tasks={academicTasks} />
      )}

      {visibility.overloadAlert && !isLoading && !error && academicTasks.length > 0 && (
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
          visibility={visibility}
        />
      )}

      {visibility.gradeCalculator && !isLoading && !error && academicAreas.length > 0 && activeProgram && (
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
            <EmptyState
              message={
                academicTasks.length === 0
                  ? 'You have no academic tasks registered.'
                  : 'No tasks match the current filters.'
              }
            />
          ) : (
            <>
              <BulkActionsBar
                selectedCount={selectedIds.size}
                onMarkDone={markSelectedDone}
                onDelete={deleteSelected}
                onClear={clearSelection}
              />
              <TasksTable
                tasks={filteredTasks}
                academicTaskTypes={academicTaskTypes}
                onReschedule={rescheduleToTomorrow}
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