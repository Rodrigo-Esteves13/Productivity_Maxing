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
    type: taskTypes[0] || '',       // Seleciona o 1º valor dinamicamente
    difficulty: difficulties[0] || '', // Seleciona o 1º valor dinamicamente
    areaId: '',
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
      const payload = {
        ...formData,
        date: new Date(formData.date).toISOString(),
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

      <div>
        <label className="block text-sm font-medium text-neutral-300 mb-1">Título</label>
        <input 
          required
          type="text" 
          value={formData.title}
          onChange={(e) => setFormData({...formData, title: e.target.value})}
          className="w-full bg-neutral-950 border border-neutral-700 rounded-md px-3 py-2 text-white focus:outline-none focus:border-violet-500"
          placeholder="Ex: Estudar React"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-neutral-300 mb-1">Data</label>
          <input 
            required
            type="date" 
            value={formData.date}
            onChange={(e) => setFormData({...formData, date: e.target.value})}
            className="w-full bg-neutral-950 border border-neutral-700 rounded-md px-3 py-2 text-white focus:outline-none focus:border-violet-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-300 mb-1">Área</label>
          <select 
            required
            value={formData.areaId}
            onChange={(e) => setFormData({...formData, areaId: e.target.value})}
            className="w-full bg-neutral-950 border border-neutral-700 rounded-md px-3 py-2 text-white focus:outline-none focus:border-violet-500"
          >
            <option value="" disabled>Selecionar Área...</option>
            {areas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-neutral-300 mb-1">Dificuldade</label>
          <select 
            value={formData.difficulty}
            onChange={(e) => setFormData({...formData, difficulty: e.target.value})}
            className="w-full bg-neutral-950 border border-neutral-700 rounded-md px-3 py-2 text-white focus:outline-none focus:border-violet-500"
          >
            {difficulties.map((diff) => (
              <option key={diff} value={diff}>
                {diff.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-300 mb-1">Tipo</label>
          <select 
            value={formData.type}
            onChange={(e) => setFormData({...formData, type: e.target.value})}
            className="w-full bg-neutral-950 border border-neutral-700 rounded-md px-3 py-2 text-white focus:outline-none focus:border-violet-500"
          >
            {taskTypes.map((type) => (
              <option key={type} value={type}>
                {type.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="pt-4 flex justify-end gap-3 border-t border-neutral-800">
        <button 
          type="button" 
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-neutral-300 hover:text-white"
        >
          Cancelar
        </button>
        <button 
          type="submit" 
          disabled={isSubmitting}
          className="px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm font-medium rounded-md transition-colors"
        >
          {isSubmitting ? 'A guardar...' : 'Criar Tarefa'}
        </button>
      </div>
    </form>
  );
}