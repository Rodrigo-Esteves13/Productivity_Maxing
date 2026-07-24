import PageLayout from '../components/Layout/PageLayout';
import PageHeader from '../components/Layout/PageHeader';
import Modal from '../components/UI/Modal';
import ActionButton from '../components/UI/ActionButton';
import LoadingState from '../components/UI/LoadingState';
import ErrorState from '../components/UI/ErrorState';
import EmptyState from '../components/UI/EmptyState';
import ModalHeaderActions from '../components/UI/ModalHeaderActions';
import AreaGrid from '../components/Areas/AreaGrid';
import AreaForm from '../components/Areas/AreaForm';
import AreaDetailView from '../components/Areas/AreaDetailView';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { useAreasPage } from '../hooks/useAreasPage';

export default function Areas() {
  useDocumentTitle('Areas');
  const {
    areas,
    taskTypes,
    isLoading,
    error,
    isCreateModalOpen,
    selectedArea,
    isEditing,
    isSubmitting,
    openCreateModal,
    closeCreateModal,
    openDetailModal,
    startEditing,
    stopEditing,
    closeDetailModal,
    handleCreateArea,
    handleEditArea,
    handleDeleteArea,
  } = useAreasPage();

  return (
    <PageLayout>
      <PageHeader
        title="Area Management"
        description="Area exclusive to Administrators to manage the system's subjects and categories."
        action={
          <ActionButton color="amber" onClick={openCreateModal}>
            + New Area
          </ActionButton>
        }
      />

      {isLoading ? (
        <LoadingState message="Loading areas..." />
      ) : error ? (
        <ErrorState message={error} />
      ) : areas.length === 0 ? (
        <EmptyState message="No areas registered in the system." />
      ) : (
        <AreaGrid areas={areas} onSelect={openDetailModal} onEdit={startEditing} onDelete={handleDeleteArea} />
      )}

      {/* Modal exclusivo de criação */}
      <Modal isOpen={isCreateModalOpen} onClose={closeCreateModal} title="Create New Area">
        <AreaForm
          idPrefix="create-area"
          taskTypes={taskTypes}
          onSubmit={handleCreateArea}
          onCancel={closeCreateModal}
          isSubmitting={isSubmitting}
          submitLabel="Create Area"
          submittingLabel="Creating..."
        />
      </Modal>

      {/* Modal de detalhes e edição */}
      <Modal
        isOpen={selectedArea !== null}
        onClose={closeDetailModal}
        title={isEditing ? 'Edit Area' : 'Area Details'}
        action={
          selectedArea && (
            <ModalHeaderActions
              isEditing={isEditing}
              onToggleEdit={() => {
                if (isEditing) {
                  stopEditing(); // Cancela a edição e volta a Ver
                } else {
                  startEditing(selectedArea); // Transita de Ver para Editar
                }
              }}
              onDelete={() => handleDeleteArea(selectedArea.id)}
              deleteTitle="Delete Area"
              editTitle="Edit area"
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
              submitLabel="Save Changes"
              submittingLabel="Saving..."
            />
          ) : (
            <AreaDetailView area={selectedArea} taskTypes={taskTypes} />
          ))}
      </Modal>
    </PageLayout>
  );
}
