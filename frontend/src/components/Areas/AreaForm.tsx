import { useState, type SyntheticEvent } from 'react';
import Input from '../UI/Input';
import Select from '../UI/Select';
import Button from '../UI/Button';
import FormField from '../UI/FormField';
import ColorPickerField from './ColorPickerField';
import type { TaskTypeOption } from '../../types/models';

export interface AreaFormValues {
  name: string;
  colorHex: string;
  defaultTaskType: string | null;
}

interface AreaFormProps {
  idPrefix: string;
  initialValues?: AreaFormValues;
  taskTypes: TaskTypeOption[];
  onSubmit: (values: AreaFormValues) => Promise<void> | void;
  onCancel: () => void;
  isSubmitting: boolean;
  submitLabel: string;
  submittingLabel: string;
}

const DEFAULT_VALUES: AreaFormValues = { name: '', colorHex: '#8b5cf6', defaultTaskType: null };

export default function AreaForm({
  idPrefix,
  initialValues = DEFAULT_VALUES,
  taskTypes,
  onSubmit,
  onCancel,
  isSubmitting,
  submitLabel,
  submittingLabel,
}: AreaFormProps) {
  const [formData, setFormData] = useState<AreaFormValues>(initialValues);

  const handleSubmit = (e: SyntheticEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-2">
      <FormField label="Area / Subject Name" htmlFor={`${idPrefix}-name`}>
        <Input
          id={`${idPrefix}-name`}
          required
          type="text"
          placeholder="E.g: Math, Web Development"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="w-full"
        />
      </FormField>

      <ColorPickerField
        id={`${idPrefix}-color`}
        value={formData.colorHex}
        onChange={(colorHex) => setFormData({ ...formData, colorHex })}
      />

      <FormField label="Associated Type (optional)" htmlFor={`${idPrefix}-default-type`}>
        <Select
          id={`${idPrefix}-default-type`}
          value={formData.defaultTaskType ?? ''}
          onChange={(e) =>
            setFormData({ ...formData, defaultTaskType: e.target.value || null })
          }
        >
          <option value="">No fixed type, ask every time</option>
          {taskTypes.map((t) => (
            <option key={t.key} value={t.key}>
              {t.label}
            </option>
          ))}
        </Select>
        <p className="mt-1 text-xs text-neutral-500">
          If set, tasks created in this Area default to this Type automatically (e.g. an
          academic subject always defaults to "Academic"). Leave unset for Areas like hobbies,
          where forcing a Type doesn't make sense.
        </p>
      </FormField>

      <div className="pt-4 flex justify-end gap-3 border-t border-neutral-800 mt-6">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-medium rounded-md transition-colors"
        >
          {isSubmitting ? submittingLabel : submitLabel}
        </button>
      </div>
    </form>
  );
}
