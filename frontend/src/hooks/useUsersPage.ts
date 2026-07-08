import { useEffect, useState } from 'react';
import { getAllUsers, updateUser, deleteUser, exportUserData } from '../api/userService';
import { downloadJson } from '../utils/downloadJson';
import type { User } from '../types/models';
import type { UserFormValues } from '../components/Users/UserEditForm';

export function useUsersPage(currentUserId: string | undefined) {
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
      const isSelf = editingUser.id === currentUserId;
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
    if (target.id === currentUserId) return; // botão já vem desativado, isto é só defesa extra

    const confirmed = window.confirm(
      `Are you sure you want to permanently delete "${target.name || target.email}"? This cannot be undone.`
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

  return {
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
  };
}
