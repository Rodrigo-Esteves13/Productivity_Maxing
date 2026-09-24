import PageLayout from '../components/Layout/PageLayout';
import PageHeader from '../components/Layout/PageHeader';
import Modal from '../components/UI/Modal';
import ErrorState from '../components/UI/ErrorState';
import EmptyState from '../components/UI/EmptyState';
import TableSkeleton from '../components/UI/TableSkeleton';
import UsersTable from '../components/Users/UsersTable';
import UserEditForm from '../components/Users/UserEditForm';
import UserStatusModal from '../components/Users/UserStatusModal';
import AppealsPanel from '../components/Users/AppealsPanel';
import { useAuth } from '../context/useAuth';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { useUsersPage } from '../hooks/useUsersPage';

export default function Users() {
  useDocumentTitle('User Management');
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
        title="User Management"
        description="Area exclusive to Administrators to view, edit, and export or delete user accounts."
      />

      <AppealsPanel />

      {isLoading ? (
        <TableSkeleton rows={6} columns={6} />
      ) : error ? (
        <ErrorState message={error} />
      ) : users.length === 0 ? (
        <EmptyState message="No users registered in the system." />
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

      {exportingId && <p className="mt-3 text-xs text-neutral-500">Preparing export...</p>}

      <Modal isOpen={editingUser !== null} onClose={() => setEditingUser(null)} title="Edit User">
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
        title={statusActionMode === 'ban' ? 'Ban User' : 'Suspend User'}
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
