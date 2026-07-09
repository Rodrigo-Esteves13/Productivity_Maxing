import { useCallback, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import type { Task, TaskTypeOption, AcademicTaskTypeOption } from '../../types/models';
import TaskFormFields, { type TaskFormFieldValues } from './TaskFormFields';
import FormError from '../UI/FormError';
import Button from '../UI/Button';
import { buildTaskPayload } from '../../utils/taskPayload';

interface AreaOption {
  id: string;
  name: string;
  defaultTaskType: string | null;
}

interface TaskEditFormProps {
  task: Task;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
  areas: AreaOption[];
  taskTypes: TaskTypeOption[];
  academicTaskTypes: AcademicTaskTypeOption[];
  difficulties: string[];
  progressStatuses: string[];
}

function buildInitialValues(task: Task): TaskFormFieldValues {
  return {
    title: task.title,
    date: task.date.split('T')[0],
    type: task.type,
    academicType: task.academicType ?? '',
    difficulty: task.difficulty,
    progressStatus: task.progressStatus,
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
  academicTaskTypes,
  difficulties,
  progressStatuses,
}: TaskEditFormProps) {
  const initialValues = useMemo(() => buildInitialValues(task), [task]);
  const [formData, setFormData] = useState<TaskFormFieldValues>(initialValues);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const updateField = useCallback((field: keyof TaskFormFieldValues, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setError('');

      if (!formData.areaId) {
        setError('Please select an Area.');
        return;
      }

      setIsSubmitting(true);
      try {
        const payload = buildTaskPayload(formData, { includeRealGrade: true });

        await onSubmit(payload);
      } catch (err: any) {
        setError(err.response?.data?.message || 'Error updating task.');
      } finally {
        setIsSubmitting(false);
      }
    },
    [formData, onSubmit]
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <FormError message={error} />}

      <TaskFormFields
        idPrefix="edit-task"
        values={formData}
        onChange={updateField}
        areas={areas}
        taskTypes={taskTypes}
        academicTaskTypes={academicTaskTypes}
        difficulties={difficulties}
        progressStatuses={progressStatuses}
        showRealGrade
        showProgressStatus
      />

      <div className="pt-4 flex justify-end gap-3 border-t border-neutral-800">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </form>
  );
}
