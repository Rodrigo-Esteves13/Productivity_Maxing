import React, { useState } from 'react';

interface AreaOption {
  id: string;
  name: string;
}

interface TaskFormProps {
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
  areas: AreaOption[];
  taskTypes: string[];
  difficulties: string[];
}

export default function TaskForm({ onSubmit, onCancel, areas, taskTypes, difficulties }: TaskFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    title: '',
    date: new Date().toISOString().split('T')[0],
    type: taskTypes[0] || '',
    difficulty: difficulties[0] || '',
    areaId: '',
    topics: '',
    referenceLink: '',
    targetGrade: '',
    weightPercentage: '',
  });

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.areaId) {
      setError('Por favor, seleciona uma Área.');
      return;
    }

    setIsSubmitting(true);

    try {
      // Processamento dos dados para o backend
      const payload = {
        ...formData,
        date: new Date(formData.date).toISOString(),
        targetGrade: formData.targetGrade ? parseFloat(formData.targetGrade) : undefined,
        weightPercentage: formData.weightPercentage ? parseFloat(formData.weightPercentage) : undefined,
        topics: formData.topics || undefined,
        referenceLink: formData.referenceLink || undefined,
      };
      
      await onSubmit(payload);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao criar tarefa.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 bg-red-900/50 border border-red-500 rounded-lg text-red-200 text-sm">
          {error}
        </div>
      )}

      {/* Campos Principais */}
      <div>
        <label className="block text-sm font-medium text-neutral-300 mb-1">Título</label>
        <input 
          required
          type="text" 
          value={formData.title}
          onChange={(e) => setFormData({...formData, title: e.target.value})}
          className="w-full bg-neutral-950 border border-neutral-700 rounded-md px-3 py-2 text-white"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-neutral-300 mb-1">Data</label>
          <input required type="date" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} className="w-full bg-neutral-950 border border-neutral-700 rounded-md px-3 py-2 text-white" />
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-300 mb-1">Área</label>
          <select required value={formData.areaId} onChange={(e) => setFormData({...formData, areaId: e.target.value})} className="w-full bg-neutral-950 border border-neutral-700 rounded-md px-3 py-2 text-white">
            <option value="" disabled>Selecionar Área...</option>
            {areas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-neutral-300 mb-1">Dificuldade</label>
          <select value={formData.difficulty} onChange={(e) => setFormData({...formData, difficulty: e.target.value})} className="w-full bg-neutral-950 border border-neutral-700 rounded-md px-3 py-2 text-white">
            {difficulties.map((d) => <option key={d} value={d}>{d.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-300 mb-1">Tipo</label>
          <select value={formData.type} onChange={(e) => setFormData({...formData, type: e.target.value})} className="w-full bg-neutral-950 border border-neutral-700 rounded-md px-3 py-2 text-white">
            {taskTypes.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
      </div>

      {/* Campos Opcionais */}
      <div className="space-y-4 pt-4 border-t border-neutral-800">
        <p className="text-xs font-semibold text-neutral-500 uppercase">Informação Opcional</p>
        <div className="grid grid-cols-2 gap-4">
          <input type="text" placeholder="Tópicos" value={formData.topics} onChange={(e) => setFormData({...formData, topics: e.target.value})} className="w-full bg-neutral-950 border border-neutral-700 rounded-md px-3 py-2 text-white" />
          <input type="url" placeholder="Link de referência" value={formData.referenceLink} onChange={(e) => setFormData({...formData, referenceLink: e.target.value})} className="w-full bg-neutral-950 border border-neutral-700 rounded-md px-3 py-2 text-white" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <input 
            type="number" 
            min="0" 
            max="20" 
            step="0.1" 
            placeholder="Nota Objetivo" 
            value={formData.targetGrade} 
            onChange={(e) => setFormData({...formData, targetGrade: e.target.value})} 
            className="w-full bg-neutral-950 border border-neutral-700 rounded-md px-3 py-2 text-white" 
          />
          <input 
            type="number" 
            min="0" 
            max="100" 
            step="0.1" 
            placeholder="Peso (%)" 
            value={formData.weightPercentage} 
            onChange={(e) => setFormData({...formData, weightPercentage: e.target.value})} 
            className="w-full bg-neutral-950 border border-neutral-700 rounded-md px-3 py-2 text-white" 
          />
        </div>
      </div>

      <div className="pt-4 flex justify-end gap-3 border-t border-neutral-800">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-neutral-300 hover:text-white">Cancelar</button>
        <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium rounded-md transition-colors">
          {isSubmitting ? 'A guardar...' : 'Criar Tarefa'}
        </button>
      </div>
    </form>
  );
}