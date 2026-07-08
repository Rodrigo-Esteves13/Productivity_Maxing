import { useState, type SyntheticEvent } from 'react';
import TaskFormFields, { type TaskFormFieldValues } from './TaskFormFields';
import FormError from '../UI/FormError';
import Button from '../UI/Button';
import type { TaskTypeOption, AcademicTaskTypeOption } from '../../types/models';

interface AreaOption {
  id: string;
  name: string;
  defaultTaskType: string | null;
}

interface TaskFormProps {
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
  areas: AreaOption[];
  taskTypes: TaskTypeOption[];
  academicTaskTypes: AcademicTaskTypeOption[];
  difficulties: string[];
}

export default function TaskForm({
  onSubmit,
  onCancel,
  areas,
  taskTypes,
  academicTaskTypes,
  difficulties,
}: TaskFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState<TaskFormFieldValues>({
    title: '',
    date: new Date().toISOString().split('T')[0],
    // Sem tipo pré-selecionado: escolher o taskTypes[0] por omissão fazia
    // com que "Academic" (order 1 no seed) ficasse ativo em Areas sem tipo
    // associado (ex: hobbies), mostrando os campos académicos por engano.
    // Só fica preenchido quando a Area o define, ou quando o utilizador
    // escolhe manualmente.
    type: '',
    academicType: '',
    difficulty: difficulties[0] || '',
    areaId: '',
    topics: '',
    referenceLink: '',
    targetGrade: '',
    weightPercentage: '',
  });

  const updateField = (field: keyof TaskFormFieldValues, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: SyntheticEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.areaId) {
      setError('Please select an Area.');
      return;
    }

    if (!formData.type) {
      setError('Please select a Type.');
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
        academicType: formData.academicType || undefined,
      };

      await onSubmit(payload);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error creating task.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <FormError message={error} />}

      <TaskFormFields
        idPrefix="create-task"
        values={formData}
        onChange={updateField}
        areas={areas}
        taskTypes={taskTypes}
        academicTaskTypes={academicTaskTypes}
        difficulties={difficulties}
      />

      <div className="pt-4 flex justify-end gap-3 border-t border-neutral-800">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : 'Create Task'}
        </Button>
      </div>
    </form>
  );
}
