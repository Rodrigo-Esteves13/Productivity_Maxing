import { useEffect, useMemo, useState } from 'react';
import PageLayout from '../components/Layout/PageLayout';
import PageHeader from '../components/Layout/PageHeader';
import ErrorState from '../components/UI/ErrorState';
import EmptyState from '../components/UI/EmptyState';
import TasksTable from '../components/Dashboard/TasksTable';
import TasksTableSkeleton from '../components/Dashboard/TasksTableSkeleton';
import DashboardFilters from '../components/Dashboard/DashboardFilters';
import { EMPTY_DASHBOARD_FILTERS, type DashboardFiltersState } from '../components/Dashboard/dashboardFilters.types';
import { getUserTasks, getUserAreas, getTaskMetadata, bulkUpdateTaskStatus, bulkDeleteTasks } from '../api/userService';
import { getDateStatus } from '../utils/taskDateStatus';
import type { Task, Area, AcademicTaskTypeOption } from '../types/models';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { useQuickReschedule } from '../hooks/useQuickReschedule';
import { useAcademic } from '../context/useAcademic';
import GpaSummary from '../components/Dashboard/GpaSummary';
import PeriodProgressBar from '../components/Dashboard/PeriodProgressBar';
import GradeNeededCalculator from '../components/Dashboard/GradeNeededCalculator';
import UpcomingTasksCard from '../components/Dashboard/UpcomingTasksCard';
import AtRiskTasksCard from '../components/Dashboard/AtRiskTasksCard';
import DeadlineOverlapCard from '../components/Dashboard/DeadlineOverlapCard';
import OverloadAlertCard from '../components/Dashboard/OverloadAlertCard';
import AreaBreakdownCard from '../components/Dashboard/AreaBreakdownCard';
import StudyActivityCard from '../components/Dashboard/StudyActivityCard';
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
import TaskImportModal from '../components/Dashboard/TaskImportModal';

const DASHBOARD_TASK_TYPE_KEY = 'ACADEMICO';

export default function Dashboard() {
  useDocumentTitle('Dashboard');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [academicTaskTypes, setAcademicTaskTypes] = useState<AcademicTaskTypeOption[]>([]);
  const [difficulties, setDifficulties] = useState<string[]>([]);
  const [progressStatuses, setProgressStatuses] = useState<string[]>([]);

  const [isTasksLoading, setIsTasksLoading] = useState(true);
  const [isMetaLoading, setIsMetaLoading] = useState(true);
  // Kept as a single derived flag so every existing `!isLoading` guard
  // below (the widget cards, the table/filters swap) doesn't need to be
  // touched individually - it's still true exactly when it used to be
  // true, "everything this page needs is in".
  const isLoading = isTasksLoading || isMetaLoading;
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<DashboardFiltersState>(EMPTY_DASHBOARD_FILTERS);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Instantiates the reschedule hook
  const { rescheduleToTomorrow, reschedulingId } = useQuickReschedule((updatedTask) => {
    setTasks((prev) => prev.map((t) => (t.id === updatedTask.id ? updatedTask : t)));
  });

  // The Dashboard always follows the period selected at the top of the
  // page (PeriodSelector, in PageLayout) - switching period = refetch.
  // "No program" (isViewingAllPrograms) also falls into the backend's
  // 'all' - no periodId restriction at all, so it already returns tasks
  // across every program, not just the active one.
  const { activeProgram, activePeriod, isViewingAllPeriods, isViewingAllPrograms, isLoading: isAcademicLoading } = useAcademic();
  const periodParam = isViewingAllPeriods || isViewingAllPrograms ? 'all' : activePeriod?.id;
  const { visibility, toggle } = useDashboardWidgetPrefs();
  const { density, toggleDensity } = useTableDensity();
  const { showArchived, toggleShowArchived } = useShowArchivedTasks();

  // A stale selection pointing at tasks that are no longer visible (e.g.
  // after narrowing the filters, or after a bulk action already removed/
  // completed them) is more confusing than useful, so any filter change
  // just resets it.
  useEffect(() => {
    setSelectedIds(new Set());
  }, [filters]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      const allSelected = filteredTasks.length > 0 && filteredTasks.every((t) => prev.has(t.id));
      return allSelected ? new Set() : new Set(filteredTasks.map((t) => t.id));
    });
  };

  const handleBulkMarkDone = async () => {
    const ids = Array.from(selectedIds);
    await bulkUpdateTaskStatus(ids, 'COMPLETED');
    setTasks((prev) =>
      prev.map((t) =>
        ids.includes(t.id)
          ? { ...t, progressStatus: 'COMPLETED', completedAt: t.completedAt ?? new Date().toISOString() }
          : t,
      ),
    );
    setSelectedIds(new Set());
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    await bulkDeleteTasks(ids);
    setTasks((prev) => prev.filter((t) => !ids.includes(t.id)));
    setSelectedIds(new Set());
  };

  const handleImported = async () => {
    try {
      const tasksData = await getUserTasks(periodParam);
      setTasks(tasksData);
    } catch (err) {
      console.error('Failed to refresh tasks after import:', err);
    }
  };

  // Areas and task metadata (types, difficulties, statuses) are a global
  // catalog, not scoped to any academic period - getUserAreas() and
  // getTaskMetadata() take no arguments at all. They used to be bundled
  // into the SAME effect as the tasks fetch below, gated on `periodParam`
  // - which meant they sat waiting through the ENTIRE
  // AuthContext -> AcademicContext resolution chain (fetchCsrfToken ->
  // refreshUser -> getPrograms -> getProgramPeriods, several sequential
  // network round-trips) before firing, even though they never needed
  // any of that. Splitting this out means they start the moment Dashboard
  // mounts, in parallel with that whole chain, instead of after it.
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
        setError('Could not load the dashboard data.');
      } finally {
        setIsMetaLoading(false);
      }
    }
    fetchMeta();
  }, []);

  useEffect(() => {
    // AcademicContext resolves activeProgram/activePeriod asynchronously
    // (getPrograms -> getProgramPeriods) - before that finishes,
    // activePeriod is null and periodParam is undefined, but this effect
    // would still fire on that undefined value the instant Dashboard
    // mounts, then fire AGAIN moments later once the real period comes
    // in. That's a whole extra tasks fetch, thrown away, on literally
    // every Dashboard load - waiting for isAcademicLoading to clear means
    // this only ever fires once, with the real value.
    if (isAcademicLoading) return;

    async function fetchTasks() {
      try {
        setIsTasksLoading(true);
        const tasksData = await getUserTasks(periodParam);
        setTasks(tasksData);
      } catch (err) {
        console.error('Failed to load dashboard tasks', err);
        setError('Could not load the dashboard data.');
      } finally {
        setIsTasksLoading(false);
      }
    }
    fetchTasks();
  }, [periodParam, isAcademicLoading]);

  const academicTasks = useMemo(
    () => tasks.filter((task) => task.type === DASHBOARD_TASK_TYPE_KEY),
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
    return academicTasks.filter((task) => {
      if (!showArchived && isTaskArchived(task)) return false;
      if (search && !task.title.toLowerCase().includes(search)) return false;
      if (filters.areaId && task.areaId !== filters.areaId) return false;
      if (filters.academicType && task.academicType !== filters.academicType) return false;
      if (filters.difficulty && task.difficulty !== filters.difficulty) return false;
      if (filters.progressStatus && task.progressStatus !== filters.progressStatus) return false;
      if (filters.dateStatus && getDateStatus(task) !== filters.dateStatus) return false;
      return true;
    });
  }, [academicTasks, filters, showArchived]);

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

      {!isLoading && !error && academicTasks.length > 0 &&
        (visibility.upcoming || visibility.atRisk || visibility.deadlineOverlap) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          {visibility.upcoming && <UpcomingTasksCard tasks={academicTasks} areas={academicAreas} />}
          {visibility.atRisk && <AtRiskTasksCard tasks={academicTasks} areas={academicAreas} />}
          {visibility.deadlineOverlap && (
            <DeadlineOverlapCard tasks={academicTasks} areas={academicAreas} />
          )}
        </div>
      )}

      {!isLoading && !error && academicAreas.length > 0 && activeProgram && (visibility.areaBreakdown || visibility.studyActivity) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          {visibility.areaBreakdown && (
            <AreaBreakdownCard
              tasks={academicTasks}
              areas={academicAreas}
              scale={activeProgram.gradeScale}
            />
          )}
          {visibility.studyActivity && <StudyActivityCard />}
        </div>
      )}

      {visibility.gradeCalculator && !isLoading && !error && academicAreas.length > 0 && activeProgram && (
        <div className="mb-6">
          <GradeNeededCalculator
            tasks={academicTasks}
            areas={academicAreas}
            scale={activeProgram.gradeScale}
          />
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
                onMarkDone={handleBulkMarkDone}
                onDelete={handleBulkDelete}
                onClear={() => setSelectedIds(new Set())}
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
              />
            </>
          )}
        </>
      )}

      <TaskImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImported={handleImported}
      />
    </PageLayout>
  );
}