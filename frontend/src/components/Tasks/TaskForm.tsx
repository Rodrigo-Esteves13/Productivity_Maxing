import { useState, type SyntheticEvent } from 'react';
import TaskFormFields, { type TaskFormFieldValues } from './TaskFormFields';
import FormError from '../UI/FormError';
import Button from '../UI/Button';
import { buildTaskPayload } from '../../utils/taskPayload';
import type { TaskTypeOption, AcademicTaskTypeOption, PriorityOption } from '../../types/models';

interface AreaOption {
  id: string;
  name: string;
  defaultTaskType: string | null;
}

interface TaskFormProps {
  onSubmit: (data: any) => Promise<any>;
  onCancel: () => void;
  areas: AreaOption[];
  taskTypes: TaskTypeOption[];
  academicTaskTypes: AcademicTaskTypeOption[];
  difficulties: string[];
  priorities: PriorityOption[];
}

export default function TaskForm({
  onSubmit,
  onCancel,
  areas,
  taskTypes,
  academicTaskTypes,
  difficulties,
  priorities,
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
    // priorities[0] (não 'MEDIUM' fixo) - Priority passou a ser um
    // catálogo gerido pelo admin em /task-types, a key 'MEDIUM' do seed
    // inicial pode não existir mais se ele a renomear/apagar. priorities
    // já vem ordenada por `order` do backend, por isso [0] é sempre "a
    // primeira da lista tal como o admin a configurou" - mesma lógica que
    // já se aplicava a difficulties[0] acima.
    priority: priorities[0]?.key || '',
    areaId: '',
    topics: '',
    referenceLink: '',
    notes: '',
    targetGrade: '',
    weightPercentage: '',
    estimatedMinutes: '',
    // Task nova nunca tem evento ainda - fica ao critério do utilizador
    // marcar a checkbox, não vem pré-marcada.
    syncToCalendar: false,
    calendarTime: '',
    calendarDurationMinutes: '60',
  });

  const updateField = (field: keyof TaskFormFieldValues, value: string | boolean) => {
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
      const payload = buildTaskPayload(formData);

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
        priorities={priorities}
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
