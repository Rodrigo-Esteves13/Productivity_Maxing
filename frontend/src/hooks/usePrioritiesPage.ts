import { useEffect, useState } from 'react';
import {
  getAdminPriorities,
  createAdminPriority,
  updateAdminPriority,
  deactivateAdminPriority,
  type PriorityFormPayload,
} from '../api/prioritiesAdminService';
import type { AdminPriority } from '../types/models';
import { useFeedback } from '../context/useFeedback';
import { translateNow } from '../i18n/translate';

export function usePrioritiesPage() {
  const { notify } = useFeedback();
  const [priorities, setPriorities] = useState<AdminPriority[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingPriority, setEditingPriority] = useState<AdminPriority | null>(null);

  const fetchAll = async () => {
    try {
      setIsLoading(true);
      setError('');
      const data = await getAdminPriorities();
      setPriorities(data);
    } catch {
      setError(translateNow('hook.errorLoadingPriorities'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const handleCreate = async (values: PriorityFormPayload) => {
    setIsSubmitting(true);
    try {
      const created = await createAdminPriority(values);
      setPriorities((prev) => [...prev, created].sort((a, b) => a.order - b.order));
      setIsCreateOpen(false);
    } catch {
      notify(translateNow('hook.errorCreatingPriorityCheckTheBackend'), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = async (values: PriorityFormPayload) => {
    if (!editingPriority) return;
    setIsSubmitting(true);
    try {
      const updated = await updateAdminPriority(editingPriority.id, values);
      setPriorities((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)));
      setEditingPriority(null);
    } catch {
      notify(translateNow('hook.errorSavingChangesCheckTheBackend'), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // isActive toggle é só um PATCH normal - mesma rota que a edição usa,
  // não a DELETE (essa também desativa, mas é pensada para o botão
  // "delete" da tabela; isto é para reativar algo já inativo sem abrir o
  // form todo). Mesmo padrão que handleToggleTaskTypeActive.
  const handleToggleActive = async (priority: AdminPriority) => {
    try {
      const updated = priority.isActive
        ? await deactivateAdminPriority(priority.id)
        : await updateAdminPriority(priority.id, { isActive: true });
      setPriorities((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)));
    } catch {
      notify(translateNow('hook.errorUpdatingPriorityStatusCheckThe'), 'error');
    }
  };

  return {
    priorities,
    isLoading,
    error,
    isSubmitting,
    isCreateOpen,
    setIsCreateOpen,
    editingPriority,
    setEditingPriority,
    handleCreate,
    handleEdit,
    handleToggleActive,
  };
}
