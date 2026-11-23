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
import { useListSearch } from '../hooks/useListSearch';
import SearchField from '../components/UI/SearchField';
import { DEFAULT_PRIORITY_COLOR, DEFAULT_TASK_TYPE_COLOR } from '../lib/taskTypeColors';
import { useI18n } from '../i18n/useI18n';
import { useConfirmAction } from '../hooks/useConfirmAction';
import ConfirmActionDialog from '../components/Turma/ConfirmActionDialog';

// Abaixo disto a pesquisa so atrapalha.
const TYPE_SEARCH_MIN = 8;

export default function TaskTypes() {
  const { t } = useI18n();
  useDocumentTitle(t('ui.taskTypeManagementTitle'));
  const deactivateConfirm = useConfirmAction(t('confirmGuard.error'));
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
    canMoveTaskType,
    handleMoveTaskType,
    retry,

    isCreateAcademicOpen,
    setIsCreateAcademicOpen,
    editingAcademic,
    setEditingAcademic,
    handleCreateAcademic,
    handleEditAcademic,
    handleToggleAcademicActive,
  } = useTaskTypesPage();
  const typeSearch = useListSearch(taskTypes, (type) => [type.label]);

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
        <ErrorState message={error} onRetry={() => void retry()} />
      ) : (
        <div className="space-y-10">
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-white">{t('ui.taskTypes')}</h2>
              <ActionButton color="amber" onClick={() => setIsCreateTaskTypeOpen(true)}>
                {t('ui.newTaskType')}
              </ActionButton>
            </div>
            {taskTypes.length >= TYPE_SEARCH_MIN && (
              <SearchField className="mb-3" value={typeSearch.query} onChange={typeSearch.setQuery} label={t('ux4packs.types.search')} />
            )}
            <TaskTypesTable
              taskTypes={typeSearch.filtered}
              isFiltering={typeSearch.isFiltering}
              noResultsMessage={typeSearch.isFiltering ? t('search.noResultsFor', { query: typeSearch.query.trim() }) : undefined}
              canMove={canMoveTaskType}
              onMove={(type, direction) => void handleMoveTaskType(type, direction)}
              onEdit={setEditingTaskType}
              onToggleActive={(type) => {
                // Reativar e inofensivo; desativar some dos formularios de todos.
                if (!type.isActive) {
                  void handleToggleTaskTypeActive(type);
                  return;
                }
                deactivateConfirm.request({
                  title: t('confirmGuard.deactivateType.title'),
                  message: t('confirmGuard.deactivateType.message', { name: type.label }),
                  confirmLabel: t('confirmGuard.deactivateType.confirm'),
                  tone: 'danger',
                  run: () => handleToggleTaskTypeActive(type),
                });
              }}
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
              colorHex: editingTaskType.colorHex ?? DEFAULT_TASK_TYPE_COLOR,
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
              colorHex: editingPriority.colorHex ?? DEFAULT_PRIORITY_COLOR,
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
      <ConfirmActionDialog state={deactivateConfirm} />
    </PageLayout>
  );
}
