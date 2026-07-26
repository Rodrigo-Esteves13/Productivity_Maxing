import { useEffect, useMemo, useState } from 'react';
import PageLayout from '../components/Layout/PageLayout';
import PageHeader from '../components/Layout/PageHeader';
import LoadingState from '../components/UI/LoadingState';
import ErrorState from '../components/UI/ErrorState';
import EmptyState from '../components/UI/EmptyState';
import TasksTable from '../components/Dashboard/TasksTable';
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
import AreaBreakdownCard from '../components/Dashboard/AreaBreakdownCard';
import StudyActivityCard from '../components/Dashboard/StudyActivityCard';
import ProgramsOverviewCard from '../components/Dashboard/ProgramsOverviewCard';
import { DashboardWidgetToggles } from '../components/Dashboard/DashboardWidgetToggles';
import { useDashboardWidgetPrefs } from '../hooks/useDashboardWidgetPrefs';
import { PrinterIcon } from '../components/UI/Icons';
import BulkActionsBar from '../components/Dashboard/BulkActionsBar';

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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Instantiates the reschedule hook
  const { rescheduleToTomorrow, reschedulingId } = useQuickReschedule((updatedTask) => {
    setTasks((prev) => prev.map((t) => (t.id === updatedTask.id ? updatedTask : t)));
  });

  // The Dashboard always follows the period selected at the top of the
  // page (PeriodSelector, in PageLayout) - switching period = refetch.
  const { activeProgram, activePeriod, isViewingAllPeriods } = useAcademic();
  const periodParam = isViewingAllPeriods ? 'all' : activePeriod?.id;
  const { visibility, toggle } = useDashboardWidgetPrefs();

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

  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        const [tasksData, areasData, metaData] = await Promise.all([
          getUserTasks(periodParam),
          getUserAreas(),
          getTaskMetadata(),
        ]);
        setTasks(tasksData);
        setAreas(areasData);
        setAcademicTaskTypes(metaData.academicTaskTypes);
        setDifficulties(metaData.difficulties);
        setProgressStatuses(metaData.progressStatuses);
      } catch (err) {
        console.error('Failed to load dashboard', err);
        setError('Could not load the dashboard data.');
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [periodParam]);

  const academicTasks = useMemo(
    () => tasks.filter((task) => task.type === DASHBOARD_TASK_TYPE_KEY),
    [tasks],
  );

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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title="Analytics Dashboard"
          description="Global view of all your academic activities, grades, and progress."
        />
        <div className="print-hide flex items-center gap-4">
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-1.5 text-sm text-neutral-400 hover:text-neutral-200"
          >
            <PrinterIcon />
            Print
          </button>
          <DashboardWidgetToggles visibility={visibility} toggle={toggle} />
        </div>
      </div>

      <GpaSummary showCreditSimulator={visibility.creditSimulator} />

      {visibility.programsOverview && <ProgramsOverviewCard />}

      {visibility.periodProgress && !isLoading && !error && !isViewingAllPeriods && activePeriod && (
        <PeriodProgressBar period={activePeriod} tasks={academicTasks} />
      )}

      {!isLoading && !error && academicTasks.length > 0 && (visibility.upcoming || visibility.atRisk) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          {visibility.upcoming && <UpcomingTasksCard tasks={academicTasks} areas={academicAreas} />}
          {visibility.atRisk && <AtRiskTasksCard tasks={academicTasks} areas={academicAreas} />}
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
        <LoadingState message="Compiling data..." className="h-64" />
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
              />
            </>
          )}
        </>
      )}
    </PageLayout>
  );
}