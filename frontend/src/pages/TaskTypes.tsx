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
import { useI18n } from '../i18n/useI18n';

export default function TaskTypes() {
  const { t } = useI18n();
  useDocumentTitle(t('ui.taskTypeManagementTitle'));
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
        title={t('ui.taskTypeManagement')}
        description={t('ui.areaExclusiveToAdministratorsNames')}
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
              <h2 className="text-lg font-semibold text-white">{t('ui.taskTypes')}</h2>
              <ActionButton color="amber" onClick={() => setIsCreateTaskTypeOpen(true)}>
                {t('ui.newTaskType')}
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
              <h2 className="text-lg font-semibold text-white">{t('ui.subcategories')}</h2>
              <ActionButton color="amber" onClick={() => setIsCreateAcademicOpen(true)}>
                {t('ui.newSubcategory')}
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
              <h2 className="text-lg font-semibold text-white">{t('ui.priorities')}</h2>
              <ActionButton color="amber" onClick={() => setIsCreatePriorityOpen(true)}>
                {t('ui.newPriority')}
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
        title={t('ui.createNewTaskType')}
      >
        <TaskTypeForm
          idPrefix="create-task-type"
          onSubmit={handleCreateTaskType}
          onCancel={() => setIsCreateTaskTypeOpen(false)}
          isSubmitting={isSubmitting}
          submitLabel={t('ui.createTaskType')}
          submittingLabel={t('common.creating')}
        />
      </Modal>

      {/* Editar Task Type */}
      <Modal
        isOpen={editingTaskType !== null}
        onClose={() => setEditingTaskType(null)}
        title={t('ui.editTaskType')}
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
            submitLabel={t('ui.saveChanges')}
            submittingLabel={t('common.saving')}
          />
        )}
      </Modal>

      {/* Criar Academic Subcategory */}
      <Modal
        isOpen={isCreateAcademicOpen}
        onClose={() => setIsCreateAcademicOpen(false)}
        title={t('ui.createNewAcademicSubcategory')}
      >
        <AcademicTaskTypeForm
          idPrefix="create-academic"
          taskTypes={taskTypes}
          onSubmit={handleCreateAcademic}
          onCancel={() => setIsCreateAcademicOpen(false)}
          isSubmitting={isSubmitting}
          submitLabel={t('ui.createSubcategory')}
          submittingLabel={t('common.creating')}
        />
      </Modal>

      {/* Editar Academic Subcategory */}
      <Modal
        isOpen={editingAcademic !== null}
        onClose={() => setEditingAcademic(null)}
        title={t('ui.editAcademicSubcategory')}
      >
        {editingAcademic && (
          <AcademicTaskTypeForm
            idPrefix="edit-academic"
            initialValues={{
              label: editingAcademic.label,
              taskTypeId: editingAcademic.taskTypeId,
              order: editingAcademic.order,
              isEvent: editingAcademic.isEvent,
            }}
            taskTypes={taskTypes}
            onSubmit={handleEditAcademic}
            onCancel={() => setEditingAcademic(null)}
            isSubmitting={isSubmitting}
            submitLabel={t('ui.saveChanges')}
            submittingLabel={t('common.saving')}
          />
        )}
      </Modal>

      {/* Criar Priority */}
      <Modal
        isOpen={isCreatePriorityOpen}
        onClose={() => setIsCreatePriorityOpen(false)}
        title={t('ui.createNewPriority')}
      >
        <PriorityForm
          idPrefix="create-priority"
          onSubmit={handleCreatePriority}
          onCancel={() => setIsCreatePriorityOpen(false)}
          isSubmitting={isPrioritySubmitting}
          submitLabel={t('ui.createPriority')}
          submittingLabel={t('common.creating')}
        />
      </Modal>

      {/* Editar Priority */}
      <Modal
        isOpen={editingPriority !== null}
        onClose={() => setEditingPriority(null)}
        title={t('ui.editPriority2')}
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
            submitLabel={t('ui.saveChanges')}
            submittingLabel={t('common.saving')}
          />
        )}
      </Modal>
    </PageLayout>
  );
}
