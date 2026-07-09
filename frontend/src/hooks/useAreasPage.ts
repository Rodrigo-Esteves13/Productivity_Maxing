import { useEffect, useState } from 'react';
import { getUserAreas, createArea, deleteArea, updateArea, getTaskMetadata } from '../api/userService';
import type { Area, TaskTypeOption } from '../types/models';
import type { AreaFormValues } from '../components/Areas/AreaForm';

export function useAreasPage() {
  const [areas, setAreas] = useState<Area[]>([]);
  const [taskTypes, setTaskTypes] = useState<TaskTypeOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedArea, setSelectedArea] = useState<Area | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Carregar Áreas + Tipos (para o seletor de "Tipo associado")
  const fetchAreas = async () => {
    try {
      setIsLoading(true);
      const [areasData, meta] = await Promise.all([getUserAreas(), getTaskMetadata()]);
      setAreas(areasData);
      setTaskTypes(meta.taskTypes);
    } catch {
      setError('Error loading areas.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAreas();
  }, []);

  const openCreateModal = () => setIsCreateModalOpen(true);

  const openDetailModal = (area: Area) => {
    setSelectedArea(area);
    setIsEditing(false); // Garante que abre sempre no modo "Ver"
  };

  const startEditing = (area: Area) => {
    setSelectedArea(area);
    setIsEditing(true); // Entra diretamente no modo "Editar"
  };

  const closeDetailModal = () => {
    setSelectedArea(null);
    setIsEditing(false);
  };

  const handleCreateArea = async (values: AreaFormValues) => {
    setIsSubmitting(true);
    try {
      // Antes fazia fetchAreas() completo depois de criar (2 pedidos: areas
      // + meta), só para acabar com a mesma lista de areas + a nova. O POST
      // já devolve a Area completa (com defaultTaskType resolvido, ver
      // AREA_INCLUDE no backend), por isso basta adicioná-la ao estado local
      // - mesmo padrão que handleEditArea já usa abaixo. taskTypes não muda
      // ao criar uma Area, não há razão para o voltar a pedir.
      const created = await createArea(values);
      setAreas((prev) => [...prev, created]);
      setIsCreateModalOpen(false);
    } catch {
      alert('Error creating area. Check the backend.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditArea = async (values: AreaFormValues) => {
    if (!selectedArea) return;

    setIsSubmitting(true);
    try {
      const updated = await updateArea(selectedArea.id, values);
      // Atualiza na grelha instantaneamente
      setAreas((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      setSelectedArea(updated);
      setIsEditing(false); // Volta ao modo "Ver"
    } catch {
      alert('Error saving changes. Check the backend.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteArea = async (id: string) => {
    const confirmed = window.confirm(
      'Are you sure? Deleting this area will delete (or affect) the tasks associated with it!'
    );
    if (!confirmed) return;

    try {
      await deleteArea(id);
      setAreas((prev) => prev.filter((area) => area.id !== id));
      // Se a área apagada estava aberta no Modal, fechamos o Modal
      if (selectedArea?.id === id) {
        closeDetailModal();
      }
    } catch {
      alert('Error deleting area. It may be in use by existing tasks.');
    }
  };

  return {
    areas,
    taskTypes,
    isLoading,
    error,
    isCreateModalOpen,
    selectedArea,
    isEditing,
    isSubmitting,
    openCreateModal,
    closeCreateModal: () => setIsCreateModalOpen(false),
    openDetailModal,
    startEditing,
    stopEditing: () => setIsEditing(false),
    closeDetailModal,
    handleCreateArea,
    handleEditArea,
    handleDeleteArea,
  };
}
