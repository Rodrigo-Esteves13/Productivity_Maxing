import { useEffect, useState } from 'react';
import {
  getAllUsers,
  updateUser,
  deleteUser,
  exportUserData,
  suspendUser,
  banUser,
  reactivateUser,
} from '../api/userService';
import { downloadJson } from '../utils/downloadJson';
import type { User } from '../types/models';
import type { UserFormValues } from '../components/Users/UserEditForm';
import { useFeedback } from '../context/useFeedback';
import { translateNow } from '../i18n/translate';

export function useUsersPage(currentUserId: string | undefined) {
  const { notify, confirm } = useFeedback();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [exportingId, setExportingId] = useState<string | null>(null);

  // Ban/suspend - 'target' + 'mode' juntos controlam o modal (ver
  // UserStatusModal): null = fechado.
  const [statusActionTarget, setStatusActionTarget] = useState<User | null>(null);
  const [statusActionMode, setStatusActionMode] = useState<'ban' | 'suspend' | null>(null);
  const [isSubmittingStatus, setIsSubmittingStatus] = useState(false);
  const [reactivatingId, setReactivatingId] = useState<string | null>(null);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      setError('');
      const data = await getAllUsers();
      setUsers(data);
    } catch {
      setError(translateNow('hook.errorLoadingUsers'));
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
      notify(translateNow('hook.errorSavingChangesCheckTheBackend'), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async (target: User) => {
    if (target.id === currentUserId) return; // botão já vem desativado, isto é só defesa extra

    const confirmed = await confirm({
      title: translateNow('hook.deleteUser'),
      message: translateNow('hook.confirmDeleteUser', { name: target.name || target.email }),
      confirmLabel: translateNow('hook.delete'),
      tone: 'danger',
    });
    if (!confirmed) return;

    try {
      await deleteUser(target.id);
      setUsers((prev) => prev.filter((u) => u.id !== target.id));
    } catch {
      notify(translateNow('hook.errorDeletingUserCheckTheBackend'), 'error');
    }
  };

  const handleExportUser = async (target: User) => {
    setExportingId(target.id);
    try {
      const data = await exportUserData(target.id);
      downloadJson(data, `user-${target.email}-export.json`);
    } catch {
      notify(translateNow('hook.errorExportingUserDataCheckThe'), 'error');
    } finally {
      setExportingId(null);
    }
  };

  const openStatusModal = (target: User, mode: 'ban' | 'suspend') => {
    setStatusActionTarget(target);
    setStatusActionMode(mode);
  };

  const closeStatusModal = () => {
    setStatusActionTarget(null);
    setStatusActionMode(null);
  };

  // `until` só é usado quando mode === 'suspend' - ver UserStatusModal.
  const handleSubmitStatusAction = async (payload: { reason: string; until?: string }) => {
    if (!statusActionTarget || !statusActionMode) return;

    setIsSubmittingStatus(true);
    try {
      const updated =
        statusActionMode === 'ban'
          ? await banUser(statusActionTarget.id, payload.reason)
          : await suspendUser(statusActionTarget.id, {
              reason: payload.reason,
              until: payload.until!,
            });
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      closeStatusModal();
    } catch {
      notify(
        statusActionMode === 'ban'
          ? translateNow('hook.errorBanningUserCheckTheBackend')
          : translateNow('hook.errorSuspendingUserCheckTheBackend'),
        'error',
      );
    } finally {
      setIsSubmittingStatus(false);
    }
  };

  const handleReactivateUser = async (target: User) => {
    setReactivatingId(target.id);
    try {
      const updated = await reactivateUser(target.id);
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
    } catch {
      notify(translateNow('hook.errorReactivatingUserCheckTheBackend'), 'error');
    } finally {
      setReactivatingId(null);
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
    statusActionTarget,
    statusActionMode,
    isSubmittingStatus,
    reactivatingId,
    openStatusModal,
    closeStatusModal,
    handleSubmitStatusAction,
    handleReactivateUser,
  };
}
