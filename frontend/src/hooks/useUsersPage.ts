import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  getUsersPage,
  updateUser,
  deleteUser,
  exportUserData,
  suspendUser,
  banUser,
  reactivateUser,
} from '../api/userService';
import {
  appendById,
  usersPageQuery,
  type UsersListCriteria,
  type UsersPageQuery,
} from '../lib/adminLists';
import { isRequestCanceled } from '../lib/abortable';
import { HTTP_BAD_REQUEST, getHttpStatus } from '../lib/httpError';
import { downloadJson } from '../utils/downloadJson';
import type { User } from '../types/models';
import type { UserFormValues } from '../components/Users/UserEditForm';
import { useFeedback } from '../context/useFeedback';
import { translateNow } from '../i18n/translate';

export function useUsersPage(currentUserId: string | undefined, criteria: UsersListCriteria) {
  const { notify, confirm } = useFeedback();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  // Um so pedido de lista de cada vez: um pedido novo cancela o anterior.
  const listRequest = useRef<AbortController | null>(null);

  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [exportingId, setExportingId] = useState<string | null>(null);

  // Ban/suspend - 'target' + 'mode' juntos controlam o modal (ver
  // UserStatusModal): null = fechado.
  const [statusActionTarget, setStatusActionTarget] = useState<User | null>(null);
  const [statusActionMode, setStatusActionMode] = useState<'ban' | 'suspend' | null>(null);
  const [isSubmittingStatus, setIsSubmittingStatus] = useState(false);
  const [reactivatingId, setReactivatingId] = useState<string | null>(null);

  const { search, role, status, sortKey, direction } = criteria;
  // Chave em texto: ordenar por nome nao muda o pedido, por isso nao o repete.
  const queryKey = JSON.stringify(usersPageQuery({ search, role, status, sortKey, direction }));
  const query = useMemo(() => JSON.parse(queryKey) as UsersPageQuery, [queryKey]);

  const fetchUsers = useCallback(async () => {
    listRequest.current?.abort();
    const controller = new AbortController();
    listRequest.current = controller;
    setIsLoading(true);
    setIsLoadingMore(false);
    setError('');
    try {
      const page = await getUsersPage(query, controller.signal);
      if (controller.signal.aborted) return;
      setUsers(page.items);
      setNextCursor(page.nextCursor);
      setIsLoading(false);
    } catch (err) {
      if (controller.signal.aborted || isRequestCanceled(err)) return;
      setError(translateNow('hook.errorLoadingUsers'));
      setIsLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void fetchUsers();
    return () => listRequest.current?.abort();
  }, [fetchUsers]);

  const loadMore = async () => {
    if (!nextCursor || isLoading || isLoadingMore) return;
    const controller = new AbortController();
    listRequest.current = controller;
    setIsLoadingMore(true);
    try {
      const page = await getUsersPage({ ...query, cursor: nextCursor }, controller.signal);
      if (controller.signal.aborted) return;
      setUsers((prev) => appendById(prev, page.items));
      setNextCursor(page.nextCursor);
    } catch (err) {
      if (controller.signal.aborted || isRequestCanceled(err)) return;
      // Cursor que ja nao serve (linha apagada ou fora do filtro): recomeca.
      if (getHttpStatus(err) === HTTP_BAD_REQUEST) void fetchUsers();
      else notify(translateNow('hook.errorLoadingUsers'), 'error');
    } finally {
      if (!controller.signal.aborted) setIsLoadingMore(false);
    }
  };

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
    reload: fetchUsers,
    hasMore: nextCursor !== null,
    isLoadingMore,
    loadMore,
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
