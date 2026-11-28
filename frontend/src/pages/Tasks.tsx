import { useEffect, useMemo, useState } from 'react';
import PageLayout from '../components/Layout/PageLayout';
import PageHeader from '../components/Layout/PageHeader';
import TaskGrid from '../components/Tasks/TaskGrid';
import TaskBoard from '../components/Tasks/TaskBoard';
import SegmentedControl, { type SegmentedOption } from '../components/UI/SegmentedControl';
import TaskSortControl from '../components/Tasks/TaskSortControl';
import TaskDetailView from '../components/Tasks/TaskDetailView';
import TaskEditForm from '../components/Tasks/TaskEditForm';
import Modal from '../components/UI/Modal';
import { useDirtyForm } from '../hooks/useDirtyForm';
import TaskForm from '../components/Tasks/TaskForm';
import ActionButton from '../components/UI/ActionButton';
import ErrorState from '../components/UI/ErrorState';
import StaleRegion from '../components/UI/StaleRegion';
import EmptyState from '../components/UI/EmptyState';
import CardGridSkeleton from '../components/UI/CardGridSkeleton';
import ModalHeaderActions from '../components/UI/ModalHeaderActions';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { useTasksPage } from '../hooks/useTasksPage';
import { useTaskShortcuts } from '../hooks/useTaskShortcuts';
import { TASK_SHORTCUTS_SCOPE_PROPS } from '../lib/shortcutGuards';
import { useShowArchivedTasks } from '../hooks/useShowArchivedTasks';
import { useTaskSortMode } from '../hooks/useTaskSortMode';
import TaskTimeline from '../components/Tasks/TaskTimeline';
import TaskMatrix from '../components/Tasks/TaskMatrix';
import ReplanOverdueModal from '../components/Tasks/ReplanOverdueModal';
import { overdueTasks } from '../lib/replanOverdue';
import { TASKS_VIEWS, isTasksView, useTasksView, type TasksView } from '../hooks/useTasksView';
import { isTaskArchived } from '../utils/taskArchive';
import { sortTasks } from '../utils/taskSorting';
import { Link, useSearchParams } from 'react-router-dom';
import { useI18n } from '../i18n/useI18n';
import PackUpdatesBanner from '../components/TaskPacks/PackUpdatesBanner';
import SearchField from '../components/UI/SearchField';
import Select from '../components/UI/Select';
import { useListSearch } from '../hooks/useListSearch';
import {
  ALL_AREAS,
  TASK_STATE_FILTERS,
  filterTasksByAreaAndState,
  isTaskStateFilter,
  taskSearchFields,
  type TaskStateFilter,
} from '../lib/taskListFilter';

const STATE_FILTER_LABEL_KEY: Record<TaskStateFilter, string> = {
  all: 'ux4tasks.stateAll',
  pending: 'ux4tasks.statePending',
  completed: 'ux4tasks.stateCompleted',
  overdue: 'ux4tasks.stateOverdue',
};

// ?view=board (ou grid) vem da paleta Ctrl+K.
const VIEW_PARAM = 'view';
const VIEW_LABEL_KEY: Record<TasksView, string> = {
  grid: 'board.view.grid',
  board: 'board.view.board',
  timeline: 'timeline.view',
  matrix: 'eisenhower.view',
};

export default function Tasks() {
  const { t } = useI18n();
  useDocumentTitle(t('nav.tasks'));
  const {
    tasks,
    replanTasks,
    areas,
    taskTypes,
    academicTaskTypes,
    difficulties,
    priorities,
    progressStatuses,
    isLoading,
    isStale,
    dataPeriod,
    error,
    reload,
    isCreateModalOpen,
    selectedTask,
    isEditing,
    openCreateModal,
    closeCreateModal,
    handleCreateTask,
    handleSelectTask,
    closeDetailModal,
    toggleEditing,
    stopEditing,
    handleUpdateTask,
    applyPrioritySuggestion,
    handleDeleteTask,
    handleDuplicateTask,
    markSelectedTaskComplete,
    moveTaskToArea,
    toggleTaskPin,
    reorderTasksInState,
    handleSubtasksChange,
    handleSubtaskConverted,
    rescheduleToTomorrow,
    completeTask,
    changeTaskStatus,
    reschedulingId
  } = useTasksPage();
  const { view, setView } = useTasksView();
  const createDirty = useDirtyForm(isCreateModalOpen);
  const editDirty = useDirtyForm(selectedTask !== null && isEditing);
  const [searchParams, setSearchParams] = useSearchParams();
  const viewParam = searchParams.get(VIEW_PARAM);

  useEffect(() => {
    if (!isTasksView(viewParam)) return;
    setView(viewParam);
    // Tira o parametro para nao lutar com o botao Grelha/Quadro depois.
    setSearchParams(
      (params) => {
        params.delete(VIEW_PARAM);
        return params;
      },
      { replace: true },
    );
  }, [viewParam, setView, setSearchParams]);

  const [isReplanOpen, setIsReplanOpen] = useState(false);
  // O periodo mudou: o modal fecha e nao volta a abrir quando o novo chega.
  if (isReplanOpen && isStale) setIsReplanOpen(false);
  const overdueCount = useMemo(() => overdueTasks(tasks).length, [tasks]);

  const viewOptions: SegmentedOption<TasksView>[] = TASKS_VIEWS.map((value) => ({
    value,
    label: t(VIEW_LABEL_KEY[value]),
  }));

  const { showArchived, toggleShowArchived } = useShowArchivedTasks();
  const { sortMode, setSortMode, direction, toggleDirection } = useTaskSortMode();

  const archivedCount = useMemo(
    () => tasks.filter((task) => isTaskArchived(task)).length,
    [tasks],
  );

  const visibleTasks = useMemo(
    () => (showArchived ? tasks : tasks.filter((task) => !isTaskArchived(task))),
    [tasks, showArchived],
  );

  // Pinned flutua sempre para o topo, em qualquer modo. Dentro de cada
  // grupo (pinned / não-pinned): 'manual' preserva a ordem que já veio do
  // backend (sortOrder, ver reorderTasksInState); 'date' e 'priority'
  // ordenam por esse campo na direção escolhida (asc: data mais próxima /
  // prioridade mais alta primeiro). Sem prioridade fica sempre no fim.
  const [areaFilter, setAreaFilter] = useState(ALL_AREAS);
  const [stateFilter, setStateFilter] = useState<TaskStateFilter>('all');
  const areaStateTasks = useMemo(
    () => filterTasksByAreaAndState(visibleTasks, areaFilter, stateFilter),
    [visibleTasks, areaFilter, stateFilter],
  );
  const search = useListSearch(areaStateTasks, taskSearchFields);
  const filteredTasks = search.filtered;
  const isFilterActive = search.isFiltering || areaFilter !== ALL_AREAS || stateFilter !== 'all';
  const clearFilters = () => {
    search.clear();
    setAreaFilter(ALL_AREAS);
    setStateFilter('all');
  };

  const sortedTasks = useMemo(() => {
    const pinned = filteredTasks.filter((task) => task.isPinned);
    const rest = filteredTasks.filter((task) => !task.isPinned);
    if (sortMode === 'manual') return [...pinned, ...rest];
    return [...sortTasks(pinned, sortMode, direction), ...sortTasks(rest, sortMode, direction)];
  }, [filteredTasks, sortMode, direction]);

  // Periodo, filtros e ordem: quando mudam, as listas voltam ao primeiro bloco.
  const listResetKey = [dataPeriod, areaFilter, stateFilter, search.query, sortMode, direction, showArchived].join('|');

  // 'n' anywhere on the page (unless a detail view is already open, to
  // avoid stacking a second modal on top of it); 'c'/'e'/Delete only while
  // viewing a task's details and not already editing it - see
  // useTaskShortcuts for the full guard (ignored while typing in a form
  // field, disabled outright while any form is open).
  useTaskShortcuts(
    {
      onCreate: () => {
        if (!selectedTask) openCreateModal();
      },
      onComplete:
        selectedTask && !isEditing && selectedTask.progressStatus !== 'COMPLETED'
          ? markSelectedTaskComplete
          : undefined,
      onEdit: selectedTask && !isEditing ? toggleEditing : undefined,
      onDelete: selectedTask && !isEditing ? handleDeleteTask : undefined,
    },
    isCreateModalOpen || isEditing,
  );

  return (
    <PageLayout>
      <PageHeader
        title={t('ui.myTasks')}
        description={t('ui.manageFilterAndTrackThe')}
        action={
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
            <Link to="/task-packs" className="whitespace-nowrap text-sm text-violet-400 hover:text-violet-300 pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:items-center">
              {t('packs.openLink')}
            </Link>
            <SegmentedControl options={viewOptions} value={view} onChange={setView} />
            {overdueCount > 0 && (
              <ActionButton disabled={isStale} onClick={() => setIsReplanOpen(true)}>{t('replan.button', { count: overdueCount })}</ActionButton>
            )}
            <TaskSortControl
              sortMode={sortMode}
              onChange={setSortMode}
              direction={direction}
              onToggleDirection={toggleDirection}
            />
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
            <div className="flex items-center gap-2">
              <ActionButton color="violet" onClick={openCreateModal}>
                {t('ui.newTask')}
              </ActionButton>
              <kbd className="hidden sm:inline text-[10px] text-neutral-500 border border-neutral-700 rounded px-1.5 py-0.5">
                N
              </kbd>
            </div>
          </div>
        }
      />

      <PackUpdatesBanner />

      <StaleRegion isStale={isStale}>
      {!isLoading && !error && tasks.length > 0 && (
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <SearchField value={search.query} onChange={search.setQuery} label={t('ux4tasks.searchLabel')} />
          <div className="w-full sm:w-48">
            <Select
              label={t('ux4tasks.areaFilter')}
              value={areaFilter}
              onChange={(e) => setAreaFilter(e.target.value)}
            >
              <option value={ALL_AREAS}>{t('ux4tasks.allAreas')}</option>
              {areas.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="w-full sm:w-48">
            <Select
              label={t('ux4tasks.stateFilter')}
              value={stateFilter}
              onChange={(e) => {
                if (isTaskStateFilter(e.target.value)) setStateFilter(e.target.value);
              }}
            >
              {TASK_STATE_FILTERS.map((value) => (
                <option key={value} value={value}>
                  {t(STATE_FILTER_LABEL_KEY[value])}
                </option>
              ))}
            </Select>
          </div>
          {isFilterActive && (
            <p className="pb-2.5 text-sm text-neutral-400" role="status">
              {t('search.count', { shown: filteredTasks.length, total: visibleTasks.length })}
            </p>
          )}
        </div>
      )}

      {isLoading ? (
        <CardGridSkeleton cards={6} />
      ) : (
        // motion-page: do esqueleto para o conteudo ha um fade curto, sem corte seco.
        <div className="motion-page">
          {error ? (
            <ErrorState message={error} onRetry={reload} />
          ) : tasks.length === 0 ? (
            <EmptyState message={t('ui.youHaveNoTasksRegistered')} />
          ) : visibleTasks.length === 0 ? (
            // Every task exists, but they're all completed-and-old enough to
            // be archived, and the toggle above is off - "no tasks" would be
            // actively misleading here (the user very much has tasks).
            <EmptyState message={t('ui.allTasksArchived', { count: archivedCount })} />
          ) : filteredTasks.length === 0 ? (
            <EmptyState
              message={
                search.isFiltering
                  ? t('search.noResultsFor', { query: search.query.trim() })
                  : t('search.noResults')
              }
              action={<ActionButton onClick={clearFilters}>{t('ux4tasks.clearFilters')}</ActionButton>}
            />
          ) : view === 'board' ? (
            <TaskBoard
              tasks={sortedTasks}
              resetKey={listResetKey}
              statuses={progressStatuses}
              onSelect={handleSelectTask}
              onChangeStatus={changeTaskStatus}
            />
          ) : view === 'matrix' ? (
            <TaskMatrix tasks={sortedTasks} onSelect={handleSelectTask} />
          ) : view === 'timeline' ? (
            <TaskTimeline tasks={sortedTasks} resetKey={listResetKey} onSelect={handleSelectTask} />
          ) : (
            <TaskGrid
              tasks={sortedTasks}
              resetKey={listResetKey}
              onSelect={handleSelectTask}
              onReschedule={rescheduleToTomorrow}
              onComplete={completeTask}
              reschedulingId={reschedulingId}
              areas={areas}
              onMoveArea={moveTaskToArea}
              onTogglePin={toggleTaskPin}
              onReorder={sortMode === 'manual' ? reorderTasksInState : undefined}
            />
          )}
        </div>
      )}
      </StaleRegion>

      {isReplanOpen && !isStale && <ReplanOverdueModal tasks={tasks} onApply={replanTasks} onClose={() => setIsReplanOpen(false)} />}

      {/* Modal de criação */}
      <Modal isOpen={isCreateModalOpen} onClose={closeCreateModal} title={t('ui.createNewTask')} isDirty={createDirty.isDirty}>
        <div onInput={createDirty.markDirty}>
        <TaskForm
          onSubmit={handleCreateTask}
          onCancel={closeCreateModal}
          areas={areas}
          taskTypes={taskTypes}
          academicTaskTypes={academicTaskTypes}
          difficulties={difficulties}
          priorities={priorities}
          progressStatuses={progressStatuses}
          existingTasks={tasks}
        />
        </div>
      </Modal>

      {/* Modal de detalhe / edição */}
      <Modal
        isOpen={selectedTask !== null}
        onClose={closeDetailModal}
        title={isEditing ? t('ui.editTask') : t('ui.taskDetails')}
        isDirty={editDirty.isDirty}
        action={
          selectedTask && (
            <ModalHeaderActions
              isEditing={isEditing}
              onToggleEdit={toggleEditing}
              onDelete={handleDeleteTask}
              onDuplicate={handleDuplicateTask}
              onComplete={
                selectedTask.progressStatus !== 'COMPLETED' ? markSelectedTaskComplete : undefined
              }
              isPinned={selectedTask.isPinned}
              onTogglePin={() => toggleTaskPin(selectedTask)}
              deleteTitle={t('ui.deleteTaskDel')}
              editTitle={t('ui.editTaskE')}
              completeTitle={t('ui.markCompleteC')}
            />
          )
        }
      >
        {selectedTask && (
          <div {...TASK_SHORTCUTS_SCOPE_PROPS}>
            {isEditing ? (
              <div onInput={editDirty.markDirty}>
              <TaskEditForm
                task={selectedTask}
                onSubmit={handleUpdateTask}
                onCancel={stopEditing}
                areas={areas}
                taskTypes={taskTypes}
                academicTaskTypes={academicTaskTypes}
                difficulties={difficulties}
                priorities={priorities}
                progressStatuses={progressStatuses}
                existingTasks={tasks}
              />
              </div>
            ) : (
              <TaskDetailView
                task={selectedTask}
                taskTypes={taskTypes}
                academicTaskTypes={academicTaskTypes}
                onSubtasksChange={handleSubtasksChange}
                onSubtaskConverted={handleSubtaskConverted}
                priorities={priorities}
                onApplyPriority={applyPrioritySuggestion}
              />
            )}
          </div>
        )}
      </Modal>
    </PageLayout>
  );
}