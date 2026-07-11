import { useState, type SyntheticEvent } from 'react';
import Input from '../UI/Input';
import Select from '../UI/Select';
import Button from '../UI/Button';
import FormField from '../UI/FormField';
import type { AcademicTaskTypeFormPayload } from '../../api/taskTypesAdminService';
import type { AdminTaskType } from '../../types/models';

interface AcademicTaskTypeFormProps {
  idPrefix: string;
  initialValues?: AcademicTaskTypeFormPayload;
  taskTypes: AdminTaskType[];
  onSubmit: (values: AcademicTaskTypeFormPayload) => Promise<void> | void;
  onCancel: () => void;
  isSubmitting: boolean;
  submitLabel: string;
  submittingLabel: string;
}

export default function AcademicTaskTypeForm({
  idPrefix,
  initialValues,
  taskTypes,
  onSubmit,
  onCancel,
  isSubmitting,
  submitLabel,
  submittingLabel,
}: AcademicTaskTypeFormProps) {
  const [formData, setFormData] = useState<AcademicTaskTypeFormPayload>(
    initialValues ?? { label: '', taskTypeId: taskTypes[0]?.id ?? '', order: 0 },
  );

  const handleSubmit = (e: SyntheticEvent) => {
    e.preventDefault();
    if (!formData.label.trim() || !formData.taskTypeId) return;
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-2">
      <FormField label="Name" htmlFor={`${idPrefix}-label`}>
        <Input
          id={`${idPrefix}-label`}
          required
          type="text"
          placeholder="E.g: Exam, Practical Assignment"
          value={formData.label}
          onChange={(e) => setFormData({ ...formData, label: e.target.value })}
        />
        <p className="mt-1 text-xs text-neutral-500">
          You can rename this whenever you want - it's only ever used for display.
        </p>
      </FormField>

      <FormField label="Parent Task Type" htmlFor={`${idPrefix}-parent`}>
        <Select
          id={`${idPrefix}-parent`}
          required
          value={formData.taskTypeId}
          onChange={(e) => setFormData({ ...formData, taskTypeId: e.target.value })}
        >
          {taskTypes.length === 0 && <option value="">No task types yet</option>}
          {taskTypes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField label="Display order" htmlFor={`${idPrefix}-order`}>
        <Input
          id={`${idPrefix}-order`}
          type="number"
          value={formData.order ?? 0}
          onChange={(e) => setFormData({ ...formData, order: Number(e.target.value) })}
        />
      </FormField>

      <div className="pt-4 flex justify-end gap-3 border-t border-neutral-800 mt-6">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <button
          type="submit"
          disabled={isSubmitting || taskTypes.length === 0}
          className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-medium rounded-md transition-colors"
        >
          {isSubmitting ? submittingLabel : submitLabel}
        </button>
      </div>
    </form>
  );
}
