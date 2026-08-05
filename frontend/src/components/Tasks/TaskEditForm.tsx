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
  onSubmit: (data: any) => Promise<any>;
  onCancel: () => void;
  areas: AreaOption[];
  taskTypes: TaskTypeOption[];
  academicTaskTypes: AcademicTaskTypeOption[];
  difficulties: string[];
  progressStatuses: string[];
}

function buildInitialValues(task: Task): TaskFormFieldValues {
  const taskDate = new Date(task.date);
  // Mesmo sinal que o backend usa (CalendarService.toGoogleEvent): task
  // sem hora fica gravada à meia-noite UTC exata.
  const hasTime =
    taskDate.getUTCHours() !== 0 ||
    taskDate.getUTCMinutes() !== 0 ||
    taskDate.getUTCSeconds() !== 0;
  const pad = (n: number) => String(n).padStart(2, '0');

  return {
    title: task.title,
    // Com hora: deriva o dia a partir dos componentes locais (para não
    // desalinhar com a hora local mostrada a seguir). Sem hora: mantém o
    // comportamento antigo, lendo a data diretamente do ISO em UTC.
    date: hasTime
      ? `${taskDate.getFullYear()}-${pad(taskDate.getMonth() + 1)}-${pad(taskDate.getDate())}`
      : task.date.split('T')[0],
    type: task.type,
    academicType: task.academicType ?? '',
    difficulty: task.difficulty,
    progressStatus: task.progressStatus,
    areaId: task.areaId,
    topics: task.topics ?? '',
    notes: task.notes ?? '',
    referenceLink: task.referenceLink ?? '',
    targetGrade: task.targetGrade != null ? String(task.targetGrade) : '',
    weightPercentage: task.weightPercentage != null ? String(task.weightPercentage) : '',
    realGrade: task.realGrade != null ? String(task.realGrade) : '',
    // Pré-marcada se a task já tem um evento - desmarcar e gravar remove-o
    // (ver handleUpdateTask em useTasksPage.ts).
    syncToCalendar: !!task.googleCalendarEventId,
    calendarTime: hasTime ? `${pad(taskDate.getHours())}:${pad(taskDate.getMinutes())}` : '',
    calendarDurationMinutes: String(task.calendarDurationMinutes ?? 60),
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

  const updateField = useCallback((field: keyof TaskFormFieldValues, value: string | boolean) => {
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
