import { useEffect, useState } from 'react';
import {
  getAdminTaskTypes,
  createAdminTaskType,
  updateAdminTaskType,
  deactivateAdminTaskType,
  getAdminAcademicTaskTypes,
  createAdminAcademicTaskType,
  updateAdminAcademicTaskType,
  deactivateAdminAcademicTaskType,
  type TaskTypeFormPayload,
  type AcademicTaskTypeFormPayload,
} from '../api/taskTypesAdminService';
import type { AdminTaskType, AdminAcademicTaskType } from '../types/models';
import { useFeedback } from '../context/useFeedback';
import { translateNow } from '../i18n/translate';
import { getApiMessage } from '../lib/httpError';
import { canMove, moveUpdates, type MoveDirection } from '../lib/taskTypeOrder';

export function useTaskTypesPage() {
  const { notify } = useFeedback();
  const [taskTypes, setTaskTypes] = useState<AdminTaskType[]>([]);
  const [academicTaskTypes, setAcademicTaskTypes] = useState<AdminAcademicTaskType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // TaskType modals
  const [isCreateTaskTypeOpen, setIsCreateTaskTypeOpen] = useState(false);
  const [editingTaskType, setEditingTaskType] = useState<AdminTaskType | null>(null);

  // AcademicTaskType modals
  const [isCreateAcademicOpen, setIsCreateAcademicOpen] = useState(false);
  const [editingAcademic, setEditingAcademic] = useState<AdminAcademicTaskType | null>(null);

  const fetchAll = async () => {
    try {
      setIsLoading(true);
      setError('');
      const [types, academicTypes] = await Promise.all([
        getAdminTaskTypes(),
        getAdminAcademicTaskTypes(),
      ]);
      setTaskTypes(types);
      setAcademicTaskTypes(academicTypes);
    } catch {
      setError(translateNow('hook.errorLoadingTaskTypes'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  // TaskType actions

  const handleCreateTaskType = async (values: TaskTypeFormPayload) => {
    setIsSubmitting(true);
    try {
      const created = await createAdminTaskType(values);
      setTaskTypes((prev) => [...prev, created].sort((a, b) => a.order - b.order));
      setIsCreateTaskTypeOpen(false);
      notify(translateNow('ux4packs.types.created', { name: created.label }), 'success');
    } catch (err) {
      notify(getApiMessage(err, translateNow('hook.errorCreatingTaskTypeCheckThe')), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditTaskType = async (values: TaskTypeFormPayload) => {
    if (!editingTaskType) return;
    setIsSubmitting(true);
    try {
      const updated = await updateAdminTaskType(editingTaskType.id, values);
      setTaskTypes((prev) => prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)));
      setEditingTaskType(null);
      notify(translateNow('ux4packs.types.saved', { name: updated.label }), 'success');
    } catch (err) {
      notify(getApiMessage(err, translateNow('hook.errorSavingChangesCheckTheBackend')), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // isActive toggle é só um PATCH normal - a mesma rota que a edição usa,
  // não a DELETE (essa também desativa, mas é pensada para o botão "delete"
  // da tabela; isto é para reativar algo já inativo sem abrir o form todo).
  const handleToggleTaskTypeActive = async (taskType: AdminTaskType) => {
    try {
      const updated = taskType.isActive
        ? await deactivateAdminTaskType(taskType.id)
        : await updateAdminTaskType(taskType.id, { isActive: true });
      setTaskTypes((prev) => prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)));
      notify(
        translateNow(taskType.isActive ? 'ux4packs.types.deactivated' : 'ux4packs.types.reactivated', {
          name: taskType.label,
        }),
        'success',
      );
    } catch (err) {
      notify(getApiMessage(err, translateNow('hook.errorUpdatingTaskTypeStatusCheck')), 'error');
    }
  };

  const canMoveTaskType = (id: string, direction: MoveDirection) => canMove(taskTypes, id, direction);

  // Sobe/desce um lugar: grava so os `order` que mudam e atualiza a lista.
  const handleMoveTaskType = async (taskType: AdminTaskType, direction: MoveDirection) => {
    const updates = moveUpdates(taskTypes, taskType.id, direction);
    if (updates.length === 0) return;
    try {
      const saved = await Promise.all(updates.map((u) => updateAdminTaskType(u.id, { order: u.order })));
      const byId = new Map(saved.map((s) => [s.id, s]));
      setTaskTypes((prev) =>
        prev.map((t) => (byId.has(t.id) ? { ...t, ...byId.get(t.id) } : t)).sort((a, b) => a.order - b.order),
      );
    } catch (err) {
      notify(getApiMessage(err, translateNow('ux4packs.types.moveError')), 'error');
      void fetchAll();
    }
  };

  // AcademicTaskType actions

  const handleCreateAcademic = async (values: AcademicTaskTypeFormPayload) => {
    setIsSubmitting(true);
    try {
      const created = await createAdminAcademicTaskType(values);
      setAcademicTaskTypes((prev) => [...prev, created].sort((a, b) => a.order - b.order));
      setIsCreateAcademicOpen(false);
    } catch {
      notify(translateNow('hook.errorCreatingAcademicSubcategoryCheckThe'), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditAcademic = async (values: AcademicTaskTypeFormPayload) => {
    if (!editingAcademic) return;
    setIsSubmitting(true);
    try {
      const updated = await updateAdminAcademicTaskType(editingAcademic.id, values);
      setAcademicTaskTypes((prev) =>
        prev.map((a) => (a.id === updated.id ? { ...a, ...updated } : a)),
      );
      setEditingAcademic(null);
    } catch {
      notify(translateNow('hook.errorSavingChangesCheckTheBackend'), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleAcademicActive = async (item: AdminAcademicTaskType) => {
    try {
      const updated = item.isActive
        ? await deactivateAdminAcademicTaskType(item.id)
        : await updateAdminAcademicTaskType(item.id, { isActive: true });
      setAcademicTaskTypes((prev) =>
        prev.map((a) => (a.id === updated.id ? { ...a, ...updated } : a)),
      );
    } catch {
      notify(translateNow('hook.errorUpdatingSubcategoryStatusCheckThe'), 'error');
    }
  };

  return {
    taskTypes,
    academicTaskTypes,
    isLoading,
    error,
    isSubmitting,

    isCreateTaskTypeOpen,
    setIsCreateTaskTypeOpen,
    editingTaskType,
    setEditingTaskType,
    handleCreateTaskType,
    handleEditTaskType,
    handleToggleTaskTypeActive,
    canMoveTaskType,
    handleMoveTaskType,
    retry: fetchAll,

    isCreateAcademicOpen,
    setIsCreateAcademicOpen,
    editingAcademic,
    setEditingAcademic,
    handleCreateAcademic,
    handleEditAcademic,
    handleToggleAcademicActive,
  };
}
