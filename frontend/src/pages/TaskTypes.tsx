import PageLayout from '../components/Layout/PageLayout';
import PageHeader from '../components/Layout/PageHeader';
import Modal from '../components/UI/Modal';
import ActionButton from '../components/UI/ActionButton';
import LoadingState from '../components/UI/LoadingState';
import ErrorState from '../components/UI/ErrorState';
import TaskTypesTable from '../components/TaskTypes/TaskTypesTable';
import AcademicTaskTypesTable from '../components/TaskTypes/AcademicTaskTypesTable';
import TaskTypeForm from '../components/TaskTypes/TaskTypeForm';
import AcademicTaskTypeForm from '../components/TaskTypes/AcademicTaskTypeForm';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { useTaskTypesPage } from '../hooks/useTaskTypesPage';

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

  return (
    <PageLayout>
      <PageHeader
        title="Task Type Management"
        description="Area exclusive to Administrators. Names can be renamed at any time - the stable identifier the app relies on internally is generated automatically and never shown here."
      />

      {isLoading ? (
        <LoadingState message="Loading task types..." />
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
              <h2 className="text-lg font-semibold text-white">Academic Subcategories</h2>
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
    </PageLayout>
  );
}
