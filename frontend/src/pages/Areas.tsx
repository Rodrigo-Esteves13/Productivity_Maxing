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
import { useI18n } from '../i18n/useI18n';
import { useAreaOrder } from '../hooks/useAreaOrder';

export default function Areas() {
  const { t } = useI18n();
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

  const { sortAreas, moveArea, resetOrder, isCustom } = useAreaOrder();
  const sorted = sortAreas(areas);
  const official = sorted.filter((a) => a.isOfficial);
  const personal = sorted.filter((a) => !a.isOfficial);
  const reorder = (draggedId: string, targetId: string) =>
    moveArea(sorted.map((a) => a.id), draggedId, targetId);

  return (
    <PageLayout>
      <PageHeader
        title={t('ui.areas')}
        description={t('ui.officialAreasAreSharedBy')}
        action={
          <div className="flex gap-2">
            {isAdmin && (
              <ActionButton color="amber" onClick={() => openCreateModal('official')}>
                {t('ui.officialArea')}
              </ActionButton>
            )}
            <ActionButton color="amber" onClick={() => openCreateModal('personal')}>
              {t('ui.myArea')}
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

          <section className="mb-8" aria-label={t('ui.myAreas')}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">{t('ui.myAreas')}</h2>
              {isCustom && (
                <button type="button" onClick={resetOrder} className="text-xs text-neutral-400 hover:text-white">
                  {t('areaOrder.reset')}
                </button>
              )}
            </div>
            <p className="mb-3 text-xs text-neutral-500">{t('areaOrder.hint')}</p>
            {personal.length === 0 ? (
              <EmptyState message={t('ui.youHaveNoPersonalAreas')} />
            ) : (
              <AreaGrid
                areas={personal}
                canManage={canManage}
                onSelect={openDetailModal}
                onEdit={startEditing}
                onDelete={handleDeleteArea}
                onReorder={reorder}
              />
            )}
          </section>

          <section aria-label={t('ui.officialAreas')}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">{t('ui.officialAreas')}</h2>
              {official.length > 0 && (
                <div className="flex gap-3 text-xs">
                  <button
                    type="button"
                    onClick={() => void handleToggleAllOfficial(false)}
                    className="text-neutral-400 hover:text-white"
                  >
                    {t('ui.turnAllOn')}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleToggleAllOfficial(true)}
                    className="text-neutral-400 hover:text-white"
                  >
                    {t('ui.turnAllOff')}
                  </button>
                </div>
              )}
            </div>
            <p className="mb-3 text-xs text-neutral-500">
              {t('ui.turnedOffAreasDisappearFrom')}
            </p>
            {official.length === 0 ? (
              <EmptyState message={t('ui.noOfficialAreasYet')} />
            ) : (
              <AreaGrid
                areas={official}
                onToggleHidden={(a) => void handleToggleHidden(a)}
                canManage={canManage}
                onSelect={openDetailModal}
                onEdit={startEditing}
                onDelete={handleDeleteArea}
                onReorder={reorder}
              />
            )}
          </section>
        </>
      )}

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
    </PageLayout>
  );
}
