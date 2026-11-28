import ErrorState from '../UI/ErrorState';
import EmptyState from '../UI/EmptyState';
import TasksTable from './TasksTable';
import TasksTableSkeleton from './TasksTableSkeleton';
import DashboardFilters from './DashboardFilters';
import BulkActionsBar from './BulkActionsBar';
import { EMPTY_DASHBOARD_FILTERS } from './dashboardFilters.types';
import { emptyMessageKey } from '../../lib/dashboardTaskFilter';
import type { DashboardPageState } from '../../hooks/useDashboardPage';
import { useI18n } from '../../i18n/useI18n';

// Filtros, tabela e acoes em massa.
export default function DashboardTasksSection({ page }: { page: DashboardPageState }) {
  const { t } = useI18n();
  const { filteredTasks, selection } = page;
  const { sort, toggleKey, setKey, toggleDirection } = page.tableSort;

  if (page.isLoading) return <TasksTableSkeleton />;
  if (page.error) return <ErrorState message={page.error} />;

  return (
    <div className="motion-page">
      <div className="print-hide">
        <DashboardFilters
          filters={page.filters}
          onChange={page.setFilters}
          areas={page.academicAreas}
          academicTaskTypes={page.academicTaskTypes}
          difficulties={page.difficulties}
          progressStatuses={page.progressStatuses}
          tags={page.allTags}
          onClear={() => page.setFilters(EMPTY_DASHBOARD_FILTERS)}
          sort={sort}
          onSortKeyChange={setKey}
          onToggleSortDirection={toggleDirection}
        />
      </div>

      {filteredTasks.length === 0 ? (
        <EmptyState message={t(emptyMessageKey(page.academicTasks.length, page.isExamMode))} />
      ) : (
        <>
          <TasksTable
            tasks={filteredTasks}
            resetKey={page.listResetKey}
            academicTaskTypes={page.academicTaskTypes}
            onReschedule={page.rescheduleToTomorrow}
            onComplete={page.completeOne}
            reschedulingId={page.reschedulingId}
            selectedIds={selection.selectedIds}
            onToggleSelect={selection.toggleSelect}
            onToggleSelectAll={selection.toggleSelectAll}
            density={page.tableDensity.density}
            sort={sort}
            onSortColumn={toggleKey}
          />
          {/* Depois da tabela: preso ao fundo do ecra enquanto ha selecao. */}
          <BulkActionsBar
            selectedCount={selection.selectedIds.size}
            onMarkDone={selection.markSelectedDone}
            onReschedule={selection.rescheduleSelected}
            onSetEffort={selection.setEffortSelected}
            onDelete={selection.deleteSelected}
            syncedCount={selection.selectedSyncedCount}
            onClear={selection.clearSelection}
          />
        </>
      )}
    </div>
  );
}
