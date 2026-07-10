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

export function useTaskTypesPage() {
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
      setError('Error loading task types.');
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
    } catch {
      alert('Error creating task type. Check the backend.');
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
    } catch {
      alert('Error saving changes. Check the backend.');
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
    } catch {
      alert('Error updating task type status. Check the backend.');
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
      alert('Error creating academic subcategory. Check the backend.');
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
      alert('Error saving changes. Check the backend.');
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
      alert('Error updating subcategory status. Check the backend.');
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

    isCreateAcademicOpen,
    setIsCreateAcademicOpen,
    editingAcademic,
    setEditingAcademic,
    handleCreateAcademic,
    handleEditAcademic,
    handleToggleAcademicActive,
  };
}
