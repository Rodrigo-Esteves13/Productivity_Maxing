import PageLayout from '../components/Layout/PageLayout';
import PageHeader from '../components/Layout/PageHeader';
import Modal from '../components/UI/Modal';
import ActionButton from '../components/UI/ActionButton';
import ErrorState from '../components/UI/ErrorState';
import TableSkeleton from '../components/UI/TableSkeleton';
import TaskTypesTable from '../components/TaskTypes/TaskTypesTable';
import AcademicTaskTypesTable from '../components/TaskTypes/AcademicTaskTypesTable';
import TaskTypeForm from '../components/TaskTypes/TaskTypeForm';
import AcademicTaskTypeForm from '../components/TaskTypes/AcademicTaskTypeForm';
import PrioritiesTable from '../components/Priorities/PrioritiesTable';
import PriorityForm from '../components/Priorities/PriorityForm';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { useTaskTypesPage } from '../hooks/useTaskTypesPage';
import { usePrioritiesPage } from '../hooks/usePrioritiesPage';

export default function TaskTypes() {
  useDocumentTitle('Task Type Management');
  const {
    taskTypes,
    academicTaskTypes,
    isLoading,
    error,
    isSubmitting,

    isCreateTaskTypeOpen,
    setIsCreateTaskTypeOpen,
    editingTaskType,
    setEditingTaskType,
    handleCreateTaskType,
    handleEditTaskType,
    handleToggleTaskTypeActive,

    isCreateAcademicOpen,
    setIsCreateAcademicOpen,
    editingAcademic,
    setEditingAcademic,
    handleCreateAcademic,
    handleEditAcademic,
    handleToggleAcademicActive,
  } = useTaskTypesPage();

  // Módulo próprio (usePrioritiesPage/prioritiesAdminService/PrioritiesModule
  // no backend) - não faz parte do catálogo de TaskType, mas mora na mesma
  // página de admin porque é o mesmo tipo de trabalho (gerir um catálogo
  // pequeno editável em runtime) e evitou abrir uma rota/nav-link novos só
  // para isto.
  const {
    priorities,
    isLoading: isPrioritiesLoading,
    error: prioritiesError,
    isSubmitting: isPrioritySubmitting,
    isCreateOpen: isCreatePriorityOpen,
    setIsCreateOpen: setIsCreatePriorityOpen,
    editingPriority,
    setEditingPriority,
    handleCreate: handleCreatePriority,
    handleEdit: handleEditPriority,
    handleToggleActive: handleTogglePriorityActive,
  } = usePrioritiesPage();

  return (
    <PageLayout>
      <PageHeader
        title="Task Type Management"
        description="Area exclusive to Administrators. Names can be renamed at any time - the stable identifier the app relies on internally is generated automatically and never shown here."
      />

      {isLoading ? (
        <div className="space-y-10">
          <TableSkeleton rows={4} columns={3} />
          <TableSkeleton rows={4} columns={3} />
        </div>
      ) : error ? (
        <ErrorState message={error} />
      ) : (
        <div className="space-y-10">
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-white">Task Types</h2>
              <ActionButton color="amber" onClick={() => setIsCreateTaskTypeOpen(true)}>
                + New Task Type
              </ActionButton>
            </div>
            <TaskTypesTable
              taskTypes={taskTypes}
              onEdit={setEditingTaskType}
              onToggleActive={handleToggleTaskTypeActive}
            />
          </section>

          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-white">Subcategories</h2>
              <ActionButton color="amber" onClick={() => setIsCreateAcademicOpen(true)}>
                + New Subcategory
              </ActionButton>
            </div>
            <AcademicTaskTypesTable
              academicTaskTypes={academicTaskTypes}
              onEdit={setEditingAcademic}
              onToggleActive={handleToggleAcademicActive}
            />
          </section>

          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-white">Priorities</h2>
              <ActionButton color="amber" onClick={() => setIsCreatePriorityOpen(true)}>
                + New Priority
              </ActionButton>
            </div>
            {isPrioritiesLoading ? (
              <TableSkeleton rows={3} columns={3} />
            ) : prioritiesError ? (
              <ErrorState message={prioritiesError} />
            ) : (
              <PrioritiesTable
                priorities={priorities}
                onEdit={setEditingPriority}
                onToggleActive={handleTogglePriorityActive}
              />
            )}
          </section>
        </div>
      )}

      {/* Criar Task Type */}
      <Modal
        isOpen={isCreateTaskTypeOpen}
        onClose={() => setIsCreateTaskTypeOpen(false)}
        title="Create New Task Type"
      >
        <TaskTypeForm
          idPrefix="create-task-type"
          onSubmit={handleCreateTaskType}
          onCancel={() => setIsCreateTaskTypeOpen(false)}
          isSubmitting={isSubmitting}
          submitLabel="Create Task Type"
          submittingLabel="Creating..."
        />
      </Modal>

      {/* Editar Task Type */}
      <Modal
        isOpen={editingTaskType !== null}
        onClose={() => setEditingTaskType(null)}
        title="Edit Task Type"
      >
        {editingTaskType && (
          <TaskTypeForm
            idPrefix="edit-task-type"
            initialValues={{
              label: editingTaskType.label,
              colorHex: editingTaskType.colorHex ?? '#8b5cf6',
              order: editingTaskType.order,
            }}
            onSubmit={handleEditTaskType}
            onCancel={() => setEditingTaskType(null)}
            isSubmitting={isSubmitting}
            submitLabel="Save Changes"
            submittingLabel="Saving..."
          />
        )}
      </Modal>

      {/* Criar Academic Subcategory */}
      <Modal
        isOpen={isCreateAcademicOpen}
        onClose={() => setIsCreateAcademicOpen(false)}
        title="Create New Academic Subcategory"
      >
        <AcademicTaskTypeForm
          idPrefix="create-academic"
          taskTypes={taskTypes}
          onSubmit={handleCreateAcademic}
          onCancel={() => setIsCreateAcademicOpen(false)}
          isSubmitting={isSubmitting}
          submitLabel="Create Subcategory"
          submittingLabel="Creating..."
        />
      </Modal>

      {/* Editar Academic Subcategory */}
      <Modal
        isOpen={editingAcademic !== null}
        onClose={() => setEditingAcademic(null)}
        title="Edit Academic Subcategory"
      >
        {editingAcademic && (
          <AcademicTaskTypeForm
            idPrefix="edit-academic"
            initialValues={{
              label: editingAcademic.label,
              taskTypeId: editingAcademic.taskTypeId,
              order: editingAcademic.order,
            }}
            taskTypes={taskTypes}
            onSubmit={handleEditAcademic}
            onCancel={() => setEditingAcademic(null)}
            isSubmitting={isSubmitting}
            submitLabel="Save Changes"
            submittingLabel="Saving..."
          />
        )}
      </Modal>

      {/* Criar Priority */}
      <Modal
        isOpen={isCreatePriorityOpen}
        onClose={() => setIsCreatePriorityOpen(false)}
        title="Create New Priority"
      >
        <PriorityForm
          idPrefix="create-priority"
          onSubmit={handleCreatePriority}
          onCancel={() => setIsCreatePriorityOpen(false)}
          isSubmitting={isPrioritySubmitting}
          submitLabel="Create Priority"
          submittingLabel="Creating..."
        />
      </Modal>

      {/* Editar Priority */}
      <Modal
        isOpen={editingPriority !== null}
        onClose={() => setEditingPriority(null)}
        title="Edit Priority"
      >
        {editingPriority && (
          <PriorityForm
            idPrefix="edit-priority"
            initialValues={{
              label: editingPriority.label,
              colorHex: editingPriority.colorHex ?? '#a3a3a3',
              order: editingPriority.order,
            }}
            onSubmit={handleEditPriority}
            onCancel={() => setEditingPriority(null)}
            isSubmitting={isPrioritySubmitting}
            submitLabel="Save Changes"
            submittingLabel="Saving..."
          />
        )}
      </Modal>
    </PageLayout>
  );
}
