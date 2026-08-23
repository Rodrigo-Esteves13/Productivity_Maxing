import { useState, type SyntheticEvent } from 'react';
import Input from '../UI/Input';
import Button from '../UI/Button';
import FormField from '../UI/FormField';
import ColorPickerField from '../Areas/ColorPickerField';
import type { PriorityFormPayload } from '../../api/prioritiesAdminService';

interface PriorityFormProps {
  idPrefix: string;
  initialValues?: PriorityFormPayload;
  onSubmit: (values: PriorityFormPayload) => Promise<void> | void;
  onCancel: () => void;
  isSubmitting: boolean;
  submitLabel: string;
  submittingLabel: string;
}

const DEFAULT_VALUES: PriorityFormPayload = { label: '', colorHex: '#a3a3a3', order: 0 };

export default function PriorityForm({
  idPrefix,
  initialValues = DEFAULT_VALUES,
  onSubmit,
  onCancel,
  isSubmitting,
  submitLabel,
  submittingLabel,
}: PriorityFormProps) {
  const [formData, setFormData] = useState<PriorityFormPayload>(initialValues);

  const handleSubmit = (e: SyntheticEvent) => {
    e.preventDefault();
    if (!formData.label.trim()) return;
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-2">
      <FormField label="Name" htmlFor={`${idPrefix}-label`}>
        <Input
          id={`${idPrefix}-label`}
          required
          type="text"
          placeholder="E.g: Urgent, Someday"
          value={formData.label}
          onChange={(e) => setFormData({ ...formData, label: e.target.value })}
        />
        <p className="mt-1 text-xs text-neutral-500">
          You can rename this whenever you want - it's only ever used for display.
        </p>
      </FormField>

      <ColorPickerField
        id={`${idPrefix}-color`}
        value={formData.colorHex ?? '#a3a3a3'}
        onChange={(colorHex) => setFormData({ ...formData, colorHex })}
      />

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
          disabled={isSubmitting}
          className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-medium rounded-md transition-colors"
        >
          {isSubmitting ? submittingLabel : submitLabel}
        </button>
      </div>
    </form>
  );
}
