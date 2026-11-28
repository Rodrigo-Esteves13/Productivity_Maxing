import Modal from '../../UI/Modal';
import ModalHeaderActions from '../../UI/ModalHeaderActions';
import AreaForm from '../AreaForm';
import AreaDetailView from '../AreaDetailView';
import { useI18n } from '../../../i18n/useI18n';
import type { AreasViewState } from '../../../hooks/useAreasView';

// Criar uma cadeira, e ver/editar a escolhida.
export default function AreaModals({ view }: { view: AreasViewState }) {
  const { t } = useI18n();
  const {
    createMode,
    closeCreateModal,
    taskTypes,
    handleCreateArea,
    isSubmitting,
    selectedArea,
    closeDetailModal,
    isEditing,
    canManage,
    canEdit,
    startEditing,
    stopEditing,
    handleDeleteArea,
    handleEditArea,
    handlePropose,
    handleWithdraw,
  } = view;

  return (
    <>
      <Modal
        isOpen={createMode !== null}
        onClose={closeCreateModal}
        title={createMode === 'official' ? t('ui.createOfficialArea') : t('ui.createMyArea')}
      >
        <AreaForm
          idPrefix="create-area"
          taskTypes={taskTypes}
          onSubmit={handleCreateArea}
          onCancel={closeCreateModal}
          isSubmitting={isSubmitting}
          submitLabel={t('ui.createArea')}
          submittingLabel={t('common.creating')}
        />
      </Modal>

      <Modal
        isOpen={selectedArea !== null}
        onClose={closeDetailModal}
        title={isEditing ? t('ui.editArea') : t('ui.areaDetails')}
        action={
          selectedArea &&
          canManage(selectedArea) && (
            <ModalHeaderActions
              isEditing={isEditing}
              onToggleEdit={() => {
                if (isEditing) stopEditing();
                else if (canEdit(selectedArea)) startEditing(selectedArea);
              }}
              onDelete={() => handleDeleteArea(selectedArea.id)}
              deleteTitle={t('ui.deleteArea')}
              editTitle={t('ui.editArea2')}
            />
          )
        }
      >
        {selectedArea &&
          (isEditing ? (
            <AreaForm
              idPrefix="edit-area"
              initialValues={{
                name: selectedArea.name,
                colorHex: selectedArea.colorHex,
                defaultTaskType: selectedArea.defaultTaskType,
                credits: selectedArea.credits,
              }}
              taskTypes={taskTypes}
              onSubmit={handleEditArea}
              onCancel={stopEditing}
              isSubmitting={isSubmitting}
              submitLabel={t('ui.saveChanges')}
              submittingLabel={t('common.saving')}
            />
          ) : (
            <AreaDetailView
              area={selectedArea}
              taskTypes={taskTypes}
              onPropose={handlePropose}
              onWithdraw={handleWithdraw}
            />
          ))}
      </Modal>
    </>
  );
}
