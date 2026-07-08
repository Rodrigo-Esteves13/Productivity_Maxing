import { useEffect, useState } from 'react';
import PageLayout from '../components/Layout/PageLayout';
import PageHeader from '../components/Layout/PageHeader';
import Modal from '../components/UI/Modal';
import ActionButton from '../components/UI/ActionButton';
import LoadingState from '../components/UI/LoadingState';
import ErrorState from '../components/UI/ErrorState';
import EmptyState from '../components/UI/EmptyState';
import ModalHeaderActions from '../components/UI/ModalHeaderActions';
import AreaGrid from '../components/Areas/AreaGrid';
import AreaForm, { type AreaFormValues } from '../components/Areas/AreaForm';
import AreaDetailView from '../components/Areas/AreaDetailView';
import { getUserAreas, createArea, deleteArea, updateArea, getTaskMetadata } from '../api/userService';
import type { Area, TaskTypeOption } from '../types/models';
import useDocumentTitle from '../hooks/useDocumentTitle';

export default function Areas() {
  useDocumentTitle('Areas');
  const [areas, setAreas] = useState<Area[]>([]);
  const [taskTypes, setTaskTypes] = useState<TaskTypeOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Estados para gerir os Modais
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

  // Acionadores dos Modais
  const openCreateModal = () => {
    setIsCreateModalOpen(true);
  };

  const openDetailModal = (area: Area) => {
    setSelectedArea(area);
    setIsEditing(false); // Garante que abre sempre no modo "Ver"
  };

  const startEditing = (area: Area) => {
    setSelectedArea(area);
    setIsEditing(true); // Entra diretamente no modo "Editar"
  };

  // Submissão: Criar
  const handleCreateArea = async (values: AreaFormValues) => {
    setIsSubmitting(true);
    try {
      await createArea(values);
      setIsCreateModalOpen(false);
      fetchAreas();
    } catch {
      alert('Error creating area. Check the backend.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submissão: Editar
  const handleEditArea = async (values: AreaFormValues) => {
    if (!selectedArea) return;

    setIsSubmitting(true);
    try {
      const updated = await updateArea(selectedArea.id, values);
      // Atualiza na grelha instantaneamente
      setAreas(prev => prev.map(a => a.id === updated.id ? updated : a));
      setSelectedArea(updated);
      setIsEditing(false); // Volta ao modo "Ver"
    } catch {
      alert('Error saving changes. Check the backend.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Apagar Área
  const handleDeleteArea = async (id: string) => {
    const confirm = window.confirm('Are you sure? Deleting this area will delete (or affect) the tasks associated with it!');
    if (!confirm) return;

    try {
      await deleteArea(id);
      setAreas(prev => prev.filter(area => area.id !== id));
      // Se a área apagada estava aberta no Modal, fechamos o Modal
      if (selectedArea?.id === id) {
        setSelectedArea(null);
        setIsEditing(false);
      }
    } catch {
      alert('Error deleting area. It may be in use by existing tasks.');
    }
  };

  return (
    <PageLayout>
      <PageHeader
        title="Area Management"
        description="Area exclusive to Administrators to manage the system's subjects and categories."
        action={
          <ActionButton color="amber" onClick={openCreateModal}>
            + New Area
          </ActionButton>
        }
      />

      {isLoading ? (
        <LoadingState message="Loading areas..." />
      ) : error ? (
        <ErrorState message={error} />
      ) : areas.length === 0 ? (
        <EmptyState message="No areas registered in the system." />
      ) : (
        <AreaGrid
          areas={areas}
          onSelect={openDetailModal}
          onEdit={startEditing}
          onDelete={handleDeleteArea}
        />
      )}

      {/* 1. MODAL EXCLUSIVO DE CRIAÇÃO */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create New Area"
      >
        <AreaForm
          idPrefix="create-area"
          taskTypes={taskTypes}
          onSubmit={handleCreateArea}
          onCancel={() => setIsCreateModalOpen(false)}
          isSubmitting={isSubmitting}
          submitLabel="Create Area"
          submittingLabel="Creating..."
        />
      </Modal>

      {/* 2. MODAL DE DETALHES E EDIÇÃO */}
      <Modal
        isOpen={selectedArea !== null}
        onClose={() => { setSelectedArea(null); setIsEditing(false); }}
        title={isEditing ? 'Edit Area' : 'Area Details'}
        action={
          selectedArea && (
            <ModalHeaderActions
              isEditing={isEditing}
              onToggleEdit={() => {
                if (isEditing) {
                  setIsEditing(false); // Cancela a edição e volta a Ver
                } else {
                  startEditing(selectedArea); // Transita de Ver para Editar
                }
              }}
              onDelete={() => handleDeleteArea(selectedArea.id)}
              deleteTitle="Delete Area"
              editTitle="Edit area"
            />
          )
        }
      >
        {selectedArea && (
          isEditing ? (
            <AreaForm
              idPrefix="edit-area"
              initialValues={{ name: selectedArea.name, colorHex: selectedArea.colorHex, defaultTaskType: selectedArea.defaultTaskType }}
              taskTypes={taskTypes}
              onSubmit={handleEditArea}
              onCancel={() => setIsEditing(false)}
              isSubmitting={isSubmitting}
              submitLabel="Save Changes"
              submittingLabel="Saving..."
            />
          ) : (
            <AreaDetailView area={selectedArea} taskTypes={taskTypes} />
          )
        )}
      </Modal>

    </PageLayout>
  );
}
