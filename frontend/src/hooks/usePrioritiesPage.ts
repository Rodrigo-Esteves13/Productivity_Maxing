import { useEffect, useState } from 'react';
import {
  getAdminPriorities,
  createAdminPriority,
  updateAdminPriority,
  deactivateAdminPriority,
  type PriorityFormPayload,
} from '../api/prioritiesAdminService';
import type { AdminPriority } from '../types/models';

export function usePrioritiesPage() {
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
      setError('Error loading priorities.');
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
      alert('Error creating priority. Check the backend.');
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
      alert('Error saving changes. Check the backend.');
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
      alert('Error updating priority status. Check the backend.');
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
