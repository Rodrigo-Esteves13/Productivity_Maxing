import { useCallback, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import type { Task } from '../../types/models';
import FormField from '../UI/FormField';
import Input from '../UI/Input';
import Button from '../UI/Button';

interface AreaOption {
  id: string;
  name: string;
}

interface TaskEditFormValues {
  title: string;
  date: string;
  type: string;
  difficulty: string;
  areaId: string;
  topics: string;
  referenceLink: string;
  targetGrade: string;
  weightPercentage: string;
  realGrade: string;
}

interface TaskEditFormProps {
  task: Task;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
  areas: AreaOption[];
  taskTypes: string[];
  difficulties: string[];
}

function buildInitialValues(task: Task): TaskEditFormValues {
  return {
    title: task.title,
    date: task.date.split('T')[0],
    type: task.type,
    difficulty: task.difficulty,
    areaId: task.areaId,
    topics: task.topics ?? '',
    referenceLink: task.referenceLink ?? '',
    targetGrade: task.targetGrade != null ? String(task.targetGrade) : '',
    weightPercentage: task.weightPercentage != null ? String(task.weightPercentage) : '',
    realGrade: task.realGrade != null ? String(task.realGrade) : '',
  };
}

export default function TaskEditForm({
  task,
  onSubmit,
  onCancel,
  areas,
  taskTypes,
  difficulties,
}: TaskEditFormProps) {
  const initialValues = useMemo(() => buildInitialValues(task), [task]);
  const [formData, setFormData] = useState<TaskEditFormValues>(initialValues);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const updateField = useCallback(
    <K extends keyof TaskEditFormValues>(field: K, value: TaskEditFormValues[K]) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
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
          targetGrade: formData.targetGrade ? parseFloat(formData.targetGrade) : undefined,
          weightPercentage: formData.weightPercentage
            ? parseFloat(formData.weightPercentage)
            : undefined,
          realGrade: formData.realGrade ? parseFloat(formData.realGrade) : undefined,
          topics: formData.topics || undefined,
          referenceLink: formData.referenceLink || undefined,
        };

        await onSubmit(payload);
      } catch (err: any) {
        setError(err.response?.data?.message || 'Erro ao atualizar tarefa.');
      } finally {
        setIsSubmitting(false);
      }
    },
    [formData, onSubmit]
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 bg-red-900/50 border border-red-500 rounded-lg text-red-200 text-sm">
          {error}
        </div>
      )}

      <FormField label="Título" htmlFor="edit-title">
        <Input
          id="edit-title"
          required
          type="text"
          value={formData.title}
          onChange={(e) => updateField('title', e.target.value)}
          className="w-full"
        />
      </FormField>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="Data" htmlFor="edit-date">
          <Input
            id="edit-date"
            required
            type="date"
            value={formData.date}
            onChange={(e) => updateField('date', e.target.value)}
            className="w-full"
          />
        </FormField>
        <FormField label="Área" htmlFor="edit-area">
          <select
            id="edit-area"
            required
            value={formData.areaId}
            onChange={(e) => updateField('areaId', e.target.value)}
            className="w-full bg-neutral-950 border border-neutral-700 rounded-md px-3 py-2 text-white"
          >
            <option value="" disabled>
              Selecionar Área...
            </option>
            {areas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.name}
              </option>
            ))}
          </select>
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="Dificuldade" htmlFor="edit-difficulty">
          <select
            id="edit-difficulty"
            value={formData.difficulty}
            onChange={(e) => updateField('difficulty', e.target.value)}
            className="w-full bg-neutral-950 border border-neutral-700 rounded-md px-3 py-2 text-white"
          >
            {difficulties.map((d) => (
              <option key={d} value={d}>
                {d.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Tipo" htmlFor="edit-type">
          <select
            id="edit-type"
            value={formData.type}
            onChange={(e) => updateField('type', e.target.value)}
            className="w-full bg-neutral-950 border border-neutral-700 rounded-md px-3 py-2 text-white"
          >
            {taskTypes.map((t) => (
              <option key={t} value={t}>
                {t.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </FormField>
      </div>

      <div className="space-y-4 pt-4 border-t border-neutral-800">
        <p className="text-xs font-semibold text-neutral-500 uppercase">Informação Opcional</p>
        <div className="grid grid-cols-2 gap-4">
          <Input
            placeholder="Tópicos"
            value={formData.topics}
            onChange={(e) => updateField('topics', e.target.value)}
            className="w-full"
          />
          <Input
            type="url"
            placeholder="Link de referência"
            value={formData.referenceLink}
            onChange={(e) => updateField('referenceLink', e.target.value)}
            className="w-full"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input
            type="number"
            min="0"
            max="20"
            step="0.1"
            placeholder="Nota Objetivo"
            value={formData.targetGrade}
            onChange={(e) => updateField('targetGrade', e.target.value)}
            className="w-full"
          />
          <Input
            type="number"
            min="0"
            max="100"
            step="0.1"
            placeholder="Peso (%)"
            value={formData.weightPercentage}
            onChange={(e) => updateField('weightPercentage', e.target.value)}
            className="w-full"
          />
        </div>
      </div>

      <div className="pt-4 border-t border-neutral-800">
        <FormField label="Nota Real" htmlFor="edit-real-grade" className="max-w-[50%]">
          <Input
            id="edit-real-grade"
            type="number"
            min="0"
            max="20"
            step="0.1"
            placeholder="Ainda não lançada"
            value={formData.realGrade}
            onChange={(e) => updateField('realGrade', e.target.value)}
            className="w-full"
          />
        </FormField>
      </div>

      <div className="pt-4 flex justify-end gap-3 border-t border-neutral-800">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" disabled={isSubmitting}>
          {isSubmitting ? 'A guardar...' : 'Guardar Alterações'}
        </Button>
      </div>
    </form>
  );
}