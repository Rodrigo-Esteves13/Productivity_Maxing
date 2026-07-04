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
import { getUserAreas, createArea, deleteArea, updateArea } from '../api/userService';
import type { Area } from '../types/models';

export default function Areas() {
  const [areas, setAreas] = useState<Area[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Estados para gerir os Modais
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedArea, setSelectedArea] = useState<Area | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Carregar Áreas
  const fetchAreas = async () => {
    try {
      setIsLoading(true);
      const data = await getUserAreas();
      setAreas(data);
    } catch (err) {
      setError('Erro ao carregar as áreas.');
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
    } catch (err) {
      alert('Erro ao criar a área. Verifica o backend.');
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
    } catch (err) {
      alert('Erro ao guardar alterações. Verifica o backend.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Apagar Área
  const handleDeleteArea = async (id: string) => {
    const confirm = window.confirm('Tens a certeza? Apagar esta área vai apagar (ou afetar) as tarefas associadas a ela!');
    if (!confirm) return;

    try {
      await deleteArea(id);
      setAreas(prev => prev.filter(area => area.id !== id));
      // Se a área apagada estava aberta no Modal, fechamos o Modal
      if (selectedArea?.id === id) {
        setSelectedArea(null);
        setIsEditing(false);
      }
    } catch (err) {
      alert('Erro ao apagar área. Pode estar a ser usada por tarefas existentes.');
    }
  };

  return (
    <PageLayout>
      <PageHeader
        title="Gestão de Áreas"
        description="Área exclusiva a Administradores para gerir as disciplinas e categorias do sistema."
        action={
          <ActionButton color="amber" onClick={openCreateModal}>
            + Nova Área
          </ActionButton>
        }
      />

      {isLoading ? (
        <LoadingState message="A carregar áreas..." />
      ) : error ? (
        <ErrorState message={error} />
      ) : areas.length === 0 ? (
        <EmptyState message="Nenhuma área registada no sistema." />
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
        title="Criar Nova Área"
      >
        <AreaForm
          idPrefix="create-area"
          onSubmit={handleCreateArea}
          onCancel={() => setIsCreateModalOpen(false)}
          isSubmitting={isSubmitting}
          submitLabel="Criar Área"
          submittingLabel="A criar..."
        />
      </Modal>

      {/* 2. MODAL DE DETALHES E EDIÇÃO */}
      <Modal
        isOpen={selectedArea !== null}
        onClose={() => { setSelectedArea(null); setIsEditing(false); }}
        title={isEditing ? 'Editar Área' : 'Detalhes da Área'}
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
              deleteTitle="Apagar Área"
              editTitle="Editar área"
            />
          )
        }
      >
        {selectedArea && (
          isEditing ? (
            <AreaForm
              idPrefix="edit-area"
              initialValues={{ name: selectedArea.name, colorHex: selectedArea.colorHex }}
              onSubmit={handleEditArea}
              onCancel={() => setIsEditing(false)}
              isSubmitting={isSubmitting}
              submitLabel="Guardar Alterações"
              submittingLabel="A guardar..."
            />
          ) : (
            <AreaDetailView area={selectedArea} />
          )
        )}
      </Modal>

    </PageLayout>
  );
}
