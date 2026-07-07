import { useEffect, useState } from 'react';
import PageLayout from '../components/Layout/PageLayout';
import PageHeader from '../components/Layout/PageHeader';
import Modal from '../components/UI/Modal';
import LoadingState from '../components/UI/LoadingState';
import ErrorState from '../components/UI/ErrorState';
import EmptyState from '../components/UI/EmptyState';
import UsersTable from '../components/Users/UsersTable';
import UserEditForm, { type UserFormValues } from '../components/Users/UserEditForm';
import { getAllUsers, updateUser, deleteUser, exportUserData } from '../api/userService';
import { useAuth } from '../context/useAuth';
import type { User } from '../types/models';
import useDocumentTitle from '../hooks/useDocumentTitle';

// Descarrega um objeto JSON como ficheiro, sem depender de nenhuma lib extra
// - cria um Blob, um <a> temporário e simula o clique.
function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function Users() {
  useDocumentTitle('User Management');
  const { user: currentUser } = useAuth();

  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [exportingId, setExportingId] = useState<string | null>(null);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      setError('');
      const data = await getAllUsers();
      setUsers(data);
    } catch {
      setError('Error loading users.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleEditUser = async (values: UserFormValues) => {
    if (!editingUser) return;

    setIsSubmitting(true);
    try {
      const isSelf = editingUser.id === currentUser?.id;
      const updated = await updateUser(editingUser.id, {
        name: values.name,
        // Nunca mandamos role para o próprio (o backend recusaria de qualquer
        // forma, mas evitamos o pedido desnecessário).
        ...(isSelf ? {} : { role: values.role }),
      });
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      setEditingUser(null);
    } catch {
      alert('Error saving changes. Check the backend.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async (target: User) => {
    if (target.id === currentUser?.id) return; // botão já vem desativado, isto é só defesa extra

    const confirmed = window.confirm(
      `Are you sure you want to permanently delete "${target.name || target.email}"? This cannot be undone.`,
    );
    if (!confirmed) return;

    try {
      await deleteUser(target.id);
      setUsers((prev) => prev.filter((u) => u.id !== target.id));
    } catch {
      alert('Error deleting user. Check the backend.');
    }
  };

  const handleExportUser = async (target: User) => {
    setExportingId(target.id);
    try {
      const data = await exportUserData(target.id);
      downloadJson(data, `user-${target.email}-export.json`);
    } catch {
      alert('Error exporting user data. Check the backend.');
    } finally {
      setExportingId(null);
    }
  };

  return (
    <PageLayout>
      <PageHeader
        title="User Management"
        description="Area exclusive to Administrators to view, edit, and export or delete user accounts."
      />

      {isLoading ? (
        <LoadingState message="Loading users..." />
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
        />
      )}

      {exportingId && (
        <p className="mt-3 text-xs text-neutral-500">Preparing export...</p>
      )}

      <Modal
        isOpen={editingUser !== null}
        onClose={() => setEditingUser(null)}
        title="Edit User"
      >
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
    </PageLayout>
  );
}
