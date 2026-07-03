import React, { useEffect, useState } from 'react';
import PageLayout from '../components/Layout/PageLayout';
import PageHeader from '../components/Layout/PageHeader';
import Modal from '../components/UI/Modal';
import Input from '../components/UI/Input';
import Button from '../components/UI/Button';
import FormField from '../components/UI/FormField';
import { TrashIcon, PencilIcon, XIcon } from '../components/UI/icons';
import { getUserAreas, createArea, deleteArea, updateArea } from '../api/userService';
import type { Area } from '../types/models';

// Componente auxiliar para desenhar as linhas do Modo de Visualização
function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    // O first:pt-0 remove o padding do topo apenas no primeiro item para alinhar com o header!
    <div className="flex flex-col gap-0.5 py-3 border-b border-neutral-800 last:border-b-0 first:pt-0">
      <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">
        {label}
      </span>
      <div className="text-sm text-neutral-200">{children}</div>
    </div>
  );
}

export default function Areas() {
  const [areas, setAreas] = useState<Area[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Estados para gerir os Modais
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedArea, setSelectedArea] = useState<Area | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Estado do formulário
  const [formData, setFormData] = useState({ name: '', colorHex: '#8b5cf6' });
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
    setFormData({ name: '', colorHex: '#8b5cf6' });
    setIsCreateModalOpen(true);
  };

  const openDetailModal = (area: Area) => {
    setSelectedArea(area);
    setIsEditing(false); // Garante que abre sempre no modo "Ver"
  };

  const startEditing = (area: Area) => {
    setSelectedArea(area);
    setFormData({ name: area.name, colorHex: area.colorHex });
    setIsEditing(true); // Entra diretamente no modo "Editar"
  };

  // Submissão: Criar
  const handleCreateArea = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    
    setIsSubmitting(true);
    try {
      await createArea(formData);
      setIsCreateModalOpen(false);
      fetchAreas();
    } catch (err) {
      alert('Erro ao criar a área. Verifica o backend.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submissão: Editar
  const handleEditArea = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !selectedArea) return;
    
    setIsSubmitting(true);
    try {
      const updated = await updateArea(selectedArea.id, formData);
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
      />

      <div className="mb-6">
        <button 
          onClick={openCreateModal}
          className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-md transition-colors"
        >
          + Nova Área
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <p className="text-neutral-400 animate-pulse">A carregar áreas...</p>
        </div>
      ) : error ? (
        <div className="p-4 bg-red-900/50 border border-red-500 rounded-lg text-red-200">
          {error}
        </div>
      ) : areas.length === 0 ? (
        <div className="p-8 text-center bg-neutral-900/50 border border-neutral-800 rounded-xl">
          <p className="text-neutral-400">Nenhuma área registada no sistema.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {areas.map(area => (
            <div key={area.id} className="p-4 bg-neutral-900/50 border border-neutral-800 rounded-xl flex items-center justify-between hover:border-neutral-700 transition-colors">
              
              {/* Secção clicável (Abre modo Leitura) */}
              <div 
                className="flex items-center gap-3 truncate cursor-pointer flex-1"
                onClick={() => openDetailModal(area)}
                title="Ver detalhes"
              >
                <div 
                  className="w-4 h-4 rounded-full flex-shrink-0 shadow-sm" 
                  style={{ backgroundColor: area.colorHex }}
                ></div>
                <span className="font-medium text-white truncate">
                  {area.name}
                </span>
              </div>
              
              {/* Botões Rápidos (Abrem logo Editar ou Apagam) */}
              <div className="flex items-center gap-1 ml-2">
                <button 
                  onClick={() => startEditing(area)}
                  className="text-neutral-500 hover:text-white transition-colors p-1.5"
                  title="Editar Área"
                >
                  <PencilIcon />
                </button>
                <button 
                  onClick={() => handleDeleteArea(area.id)}
                  className="text-neutral-500 hover:text-red-500 transition-colors p-1.5"
                  title="Apagar Área"
                >
                  <TrashIcon />
                </button>
              </div>

            </div>
          ))}
        </div>
      )}

      {/* 1. MODAL EXCLUSIVO DE CRIAÇÃO */}
      <Modal 
        isOpen={isCreateModalOpen} 
        onClose={() => setIsCreateModalOpen(false)} 
        title="Criar Nova Área"
      >
        <form onSubmit={handleCreateArea} className="space-y-4 pt-2">
          <FormField label="Nome da Área / Disciplina" htmlFor="create-area-name">
            <Input 
              id="create-area-name"
              required 
              type="text" 
              placeholder="Ex: Matemática, Desenvolvimento Web"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="w-full"
            />
          </FormField>

          <FormField label="Cor Identificativa" htmlFor="create-area-color">
            <div className="flex items-center gap-4 bg-neutral-950 border border-neutral-700 rounded-md p-2">
              <input 
                id="create-area-color"
                type="color" 
                value={formData.colorHex}
                onChange={(e) => setFormData({...formData, colorHex: e.target.value})}
                className="w-8 h-8 rounded cursor-pointer bg-transparent border-0 p-0"
              />
              <span className="text-sm font-mono text-neutral-300 uppercase tracking-wider">
                {formData.colorHex}
              </span>
            </div>
          </FormField>

          <div className="pt-4 flex justify-end gap-3 border-t border-neutral-800 mt-6">
            <Button type="button" variant="secondary" onClick={() => setIsCreateModalOpen(false)}>
              Cancelar
            </Button>
            <button 
              type="submit" 
              disabled={isSubmitting} 
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-medium rounded-md transition-colors"
            >
              {isSubmitting ? 'A criar...' : 'Criar Área'}
            </button>
          </div>
        </form>
      </Modal>

      {/* 2. MODAL DE DETALHES E EDIÇÃO */}
      <Modal 
        isOpen={selectedArea !== null} 
        onClose={() => { setSelectedArea(null); setIsEditing(false); }} 
        title={isEditing ? 'Editar Área' : 'Detalhes da Área'}
        action={
          selectedArea && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleDeleteArea(selectedArea.id)}
                title="Apagar Área"
                className="text-neutral-400 hover:text-red-500 transition-colors p-1"
              >
                <TrashIcon />
              </button>
              <button
                onClick={() => {
                  if (isEditing) {
                    setIsEditing(false); // Cancela a edição e volta a Ver
                  } else {
                    startEditing(selectedArea); // Transita de Ver para Editar
                  }
                }}
                title={isEditing ? 'Cancelar edição' : 'Editar área'}
                className="text-neutral-400 hover:text-white transition-colors p-1"
              >
                {isEditing ? <XIcon /> : <PencilIcon />}
              </button>
            </div>
          )
        }
      >
        {selectedArea && (
          isEditing ? (
            // === MODO EDIÇÃO ===
            <form onSubmit={handleEditArea} className="space-y-4 pt-2">
              <FormField label="Nome da Área / Disciplina" htmlFor="edit-area-name">
                <Input 
                  id="edit-area-name"
                  required 
                  type="text" 
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full"
                />
              </FormField>

              <FormField label="Cor Identificativa" htmlFor="edit-area-color">
                <div className="flex items-center gap-4 bg-neutral-950 border border-neutral-700 rounded-md p-2">
                  <input 
                    id="edit-area-color"
                    type="color" 
                    value={formData.colorHex}
                    onChange={(e) => setFormData({...formData, colorHex: e.target.value})}
                    className="w-8 h-8 rounded cursor-pointer bg-transparent border-0 p-0"
                  />
                  <span className="text-sm font-mono text-neutral-300 uppercase tracking-wider">
                    {formData.colorHex}
                  </span>
                </div>
              </FormField>

              <div className="pt-4 flex justify-end gap-3 border-t border-neutral-800 mt-6">
                <Button type="button" variant="secondary" onClick={() => setIsEditing(false)}>
                  Cancelar
                </Button>
                <button 
                  type="submit" 
                  disabled={isSubmitting} 
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-medium rounded-md transition-colors"
                >
                  {isSubmitting ? 'A guardar...' : 'Guardar Alterações'}
                </button>
              </div>
            </form>
          ) : (
            <div className="-mt-2">
              <DetailRow label="Nome da Área">{selectedArea.name}</DetailRow>
              <DetailRow label="Cor Associada">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-5 h-5 rounded border border-neutral-700 shadow-sm" 
                    style={{ backgroundColor: selectedArea.colorHex }}
                  ></div>
                  <span className="text-neutral-200 font-mono text-sm uppercase tracking-widest">
                    {selectedArea.colorHex}
                  </span>
                </div>
              </DetailRow>
            </div>
          )
        )}
      </Modal>

    </PageLayout>
  );
}