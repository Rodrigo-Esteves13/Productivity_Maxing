import PageLayout from '../components/Layout/PageLayout';
import PageHeader from '../components/Layout/PageHeader';
import Modal from '../components/UI/Modal';
import ErrorState from '../components/UI/ErrorState';
import EmptyState from '../components/UI/EmptyState';
import TableSkeleton from '../components/UI/TableSkeleton';
import UsersTable from '../components/Users/UsersTable';
import UserEditForm from '../components/Users/UserEditForm';
import UserStatusModal from '../components/Users/UserStatusModal';
import { useAuth } from '../context/useAuth';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { useUsersPage } from '../hooks/useUsersPage';
import { useI18n } from '../i18n/useI18n';

export default function Users() {
  const { t } = useI18n();
  useDocumentTitle(t('ui.userManagementTitle'));
  const { user: currentUser } = useAuth();
  const {
    users,
    isLoading,
    error,
    editingUser,
    isSubmitting,
    exportingId,
    setEditingUser,
    handleEditUser,
    handleDeleteUser,
    handleExportUser,
    statusActionTarget,
    statusActionMode,
    isSubmittingStatus,
    reactivatingId,
    openStatusModal,
    closeStatusModal,
    handleSubmitStatusAction,
    handleReactivateUser,
  } = useUsersPage(currentUser?.id);

  return (
    <PageLayout>
      <PageHeader
        title={t('ui.userManagement')}
        description={t('ui.areaExclusiveToAdministratorsTo')}
      />

      {isLoading ? (
        <TableSkeleton rows={6} columns={6} />
      ) : error ? (
        <ErrorState message={error} />
      ) : users.length === 0 ? (
        <EmptyState message={t('ui.noUsersRegisteredInThe')} />
      ) : (
        <UsersTable
          users={users}
          currentUserId={currentUser?.id}
          onEdit={setEditingUser}
          onDelete={handleDeleteUser}
          onExport={handleExportUser}
          onSuspend={(user) => openStatusModal(user, 'suspend')}
          onBan={(user) => openStatusModal(user, 'ban')}
          onReactivate={handleReactivateUser}
          reactivatingId={reactivatingId}
        />
      )}

      {exportingId && <p className="mt-3 text-xs text-neutral-500">{t('ui.preparingExport')}</p>}

      <Modal isOpen={editingUser !== null} onClose={() => setEditingUser(null)} title={t('ui.editUser2')}>
        {editingUser && (
          <UserEditForm
            idPrefix="edit-user"
            initialValues={{ name: editingUser.name ?? '', role: editingUser.role }}
            isSelf={editingUser.id === currentUser?.id}
            onSubmit={handleEditUser}
            onCancel={() => setEditingUser(null)}
            isSubmitting={isSubmitting}
          />
        )}
      </Modal>

      <Modal
        isOpen={statusActionTarget !== null}
        onClose={closeStatusModal}
        title={statusActionMode === 'ban' ? t('ui.banUser2') : t('ui.suspendUser2')}
      >
        {statusActionTarget && statusActionMode && (
          <UserStatusModal
            target={statusActionTarget}
            mode={statusActionMode}
            isSubmitting={isSubmittingStatus}
            onSubmit={handleSubmitStatusAction}
            onCancel={closeStatusModal}
          />
        )}
      </Modal>
    </PageLayout>
  );
}
