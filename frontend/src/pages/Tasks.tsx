import { useMemo } from 'react';
import PageLayout from '../components/Layout/PageLayout';
import PageHeader from '../components/Layout/PageHeader';
import TaskGrid from '../components/Tasks/TaskGrid';
import TaskDetailView from '../components/Tasks/TaskDetailView';
import TaskEditForm from '../components/Tasks/TaskEditForm';
import Modal from '../components/UI/Modal';
import TaskForm from '../components/Tasks/TaskForm';
import ActionButton from '../components/UI/ActionButton';
import ErrorState from '../components/UI/ErrorState';
import EmptyState from '../components/UI/EmptyState';
import CardGridSkeleton from '../components/UI/CardGridSkeleton';
import ModalHeaderActions from '../components/UI/ModalHeaderActions';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { useTasksPage } from '../hooks/useTasksPage';
import { useTaskShortcuts } from '../hooks/useTaskShortcuts';
import { useShowArchivedTasks } from '../hooks/useShowArchivedTasks';
import { isTaskArchived } from '../utils/taskArchive';

export default function Tasks() {
  useDocumentTitle('Tasks');
  const {
    tasks,
    areas,
    taskTypes,
    academicTaskTypes,
    difficulties,
    priorities,
    progressStatuses,
    isLoading,
    error,
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
    handleDeleteTask,
    handleDuplicateTask,
    markSelectedTaskComplete,
    moveTaskToArea,
    toggleTaskPin,
    rescheduleToTomorrow,
    reschedulingId
  } = useTasksPage();

  const { showArchived, toggleShowArchived } = useShowArchivedTasks();

  const archivedCount = useMemo(
    () => tasks.filter((task) => isTaskArchived(task)).length,
    [tasks],
  );

  const visibleTasks = useMemo(
    () => (showArchived ? tasks : tasks.filter((task) => !isTaskArchived(task))),
    [tasks, showArchived],
  );

  // Pinned tasks float to the top, everything else keeps whatever order
  // the backend returned it in (a stable sort - only the pinned/
  // not-pinned split moves anything, nothing else gets reshuffled).
  const sortedTasks = useMemo(
    () => [...visibleTasks].sort((a, b) => Number(b.isPinned) - Number(a.isPinned)),
    [visibleTasks],
  );

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
        title="My Tasks"
        description="Manage, filter, and track the progress of all your tasks."
        action={
          <div className="flex items-center gap-4">
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
            <div className="flex items-center gap-2">
              <ActionButton color="violet" onClick={openCreateModal}>
                + New Task
              </ActionButton>
              <kbd className="hidden sm:inline text-[10px] text-neutral-500 border border-neutral-700 rounded px-1.5 py-0.5">
                N
              </kbd>
            </div>
          </div>
        }
      />

      {isLoading ? (
        <CardGridSkeleton cards={6} />
      ) : error ? (
        <ErrorState message={error} />
      ) : tasks.length === 0 ? (
        <EmptyState message="You have no tasks registered." />
      ) : visibleTasks.length === 0 ? (
        // Every task exists, but they're all completed-and-old enough to
        // be archived, and the toggle above is off - "no tasks" would be
        // actively misleading here (the user very much has tasks).
        <EmptyState message={`All ${archivedCount} of your tasks are archived. Toggle "Show archived" above to see them.`} />
      ) : (
        <TaskGrid 
          tasks={sortedTasks} 
          onSelect={handleSelectTask} 
          onReschedule={rescheduleToTomorrow}
          reschedulingId={reschedulingId}
          areas={areas}
          onMoveArea={moveTaskToArea}
          onTogglePin={toggleTaskPin}
        />
      )}

      {/* Modal de criação */}
      <Modal isOpen={isCreateModalOpen} onClose={closeCreateModal} title="Create New Task">
        <TaskForm
          onSubmit={handleCreateTask}
          onCancel={closeCreateModal}
          areas={areas}
          taskTypes={taskTypes}
          academicTaskTypes={academicTaskTypes}
          difficulties={difficulties}
          priorities={priorities}
        />
      </Modal>

      {/* Modal de detalhe / edição */}
      <Modal
        isOpen={selectedTask !== null}
        onClose={closeDetailModal}
        title={isEditing ? 'Edit Task' : 'Task Details'}
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
              deleteTitle="Delete task (Del)"
              editTitle="Edit task (E)"
              completeTitle="Mark complete (C)"
            />
          )
        }
      >
        {selectedTask &&
          (isEditing ? (
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
            />
          ) : (
            <TaskDetailView task={selectedTask} taskTypes={taskTypes} academicTaskTypes={academicTaskTypes} />
          ))}
      </Modal>
    </PageLayout>
  );
}