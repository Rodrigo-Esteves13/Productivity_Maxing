import { useState, type SyntheticEvent } from 'react';
import Input from '../UI/Input';
import Button from '../UI/Button';
import FormField from '../UI/FormField';
import ColorPickerField from './ColorPickerField';

export interface AreaFormValues {
  name: string;
  colorHex: string;
}

interface AreaFormProps {
  idPrefix: string;
  initialValues?: AreaFormValues;
  onSubmit: (values: AreaFormValues) => Promise<void> | void;
  onCancel: () => void;
  isSubmitting: boolean;
  submitLabel: string;
  submittingLabel: string;
}

const DEFAULT_VALUES: AreaFormValues = { name: '', colorHex: '#8b5cf6' };

export default function AreaForm({
  idPrefix,
  initialValues = DEFAULT_VALUES,
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
      <FormField label="Nome da Área / Disciplina" htmlFor={`${idPrefix}-name`}>
        <Input
          id={`${idPrefix}-name`}
          required
          type="text"
          placeholder="Ex: Matemática, Desenvolvimento Web"
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

      <div className="pt-4 flex justify-end gap-3 border-t border-neutral-800 mt-6">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
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
