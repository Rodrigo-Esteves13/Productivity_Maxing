import PageLayout from '../components/Layout/PageLayout';
import PageHeader from '../components/Layout/PageHeader';
import Modal from '../components/UI/Modal';
import ActionButton from '../components/UI/ActionButton';
import ErrorState from '../components/UI/ErrorState';
import EmptyState from '../components/UI/EmptyState';
import CardGridSkeleton from '../components/UI/CardGridSkeleton';
import ModalHeaderActions from '../components/UI/ModalHeaderActions';
import AreaGrid from '../components/Areas/AreaGrid';
import AreaForm from '../components/Areas/AreaForm';
import AreaDetailView from '../components/Areas/AreaDetailView';
import AreaProposalsPanel from '../components/Areas/AreaProposalsPanel';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { useAreasPage } from '../hooks/useAreasPage';

export default function Areas() {
  useDocumentTitle('Areas');
  const {
    isAdmin,
    areas,
    proposals,
    taskTypes,
    isLoading,
    error,
    createMode,
    selectedArea,
    isEditing,
    isSubmitting,
    canManage,
    canEdit,
    openCreateModal,
    closeCreateModal,
    openDetailModal,
    startEditing,
    stopEditing,
    closeDetailModal,
    handleCreateArea,
    handleEditArea,
    handleDeleteArea,
    handleToggleHidden,
    handleToggleAllOfficial,
    handlePropose,
    handleWithdraw,
    handleApprove,
    handleReject,
  } = useAreasPage();

  const official = areas.filter((a) => a.isOfficial);
  const personal = areas.filter((a) => !a.isOfficial);

  return (
    <PageLayout>
      <PageHeader
        title="Areas"
        description="Official areas are shared by everyone. Create your own personal areas for anything that is missing, and propose them to become official."
        action={
          <div className="flex gap-2">
            {isAdmin && (
              <ActionButton color="amber" onClick={() => openCreateModal('official')}>
                + Official Area
              </ActionButton>
            )}
            <ActionButton color="amber" onClick={() => openCreateModal('personal')}>
              + My Area
            </ActionButton>
          </div>
        }
      />

      {isLoading ? (
        <CardGridSkeleton cards={6} />
      ) : error ? (
        <ErrorState message={error} />
      ) : (
        <>
          {isAdmin && (
            <AreaProposalsPanel proposals={proposals} onApprove={handleApprove} onReject={handleReject} />
          )}

          <section className="mb-8" aria-label="My areas">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-400">My areas</h2>
            {personal.length === 0 ? (
              <EmptyState message="You have no personal areas yet. Use '+ My Area' to add a subject that is not in the official list." />
            ) : (
              <AreaGrid
                areas={personal}
                canManage={canManage}
                onSelect={openDetailModal}
                onEdit={startEditing}
                onDelete={handleDeleteArea}
              />
            )}
          </section>

          <section aria-label="Official areas">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">Official areas</h2>
              {official.length > 0 && (
                <div className="flex gap-3 text-xs">
                  <button
                    type="button"
                    onClick={() => void handleToggleAllOfficial(false)}
                    className="text-neutral-400 hover:text-white"
                  >
                    Turn all on
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleToggleAllOfficial(true)}
                    className="text-neutral-400 hover:text-white"
                  >
                    Turn all off
                  </button>
                </div>
              )}
            </div>
            <p className="mb-3 text-xs text-neutral-500">
              Turned-off areas disappear from your task, notebook and quick-add lists. Existing tasks and notes
              keep working.
            </p>
            {official.length === 0 ? (
              <EmptyState message="No official areas yet." />
            ) : (
              <AreaGrid
                areas={official}
                onToggleHidden={(a) => void handleToggleHidden(a)}
                canManage={canManage}
                onSelect={openDetailModal}
                onEdit={startEditing}
                onDelete={handleDeleteArea}
              />
            )}
          </section>
        </>
      )}

      <Modal
        isOpen={createMode !== null}
        onClose={closeCreateModal}
        title={createMode === 'official' ? 'Create Official Area' : 'Create My Area'}
      >
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

      <Modal
        isOpen={selectedArea !== null}
        onClose={closeDetailModal}
        title={isEditing ? 'Edit Area' : 'Area Details'}
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
            <AreaDetailView
              area={selectedArea}
              taskTypes={taskTypes}
              onPropose={handlePropose}
              onWithdraw={handleWithdraw}
            />
          ))}
      </Modal>
    </PageLayout>
  );
}
