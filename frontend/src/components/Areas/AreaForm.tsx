import { useState, type SyntheticEvent } from 'react';
import Input from '../UI/Input';
import Select from '../UI/Select';
import Button from '../UI/Button';
import FormField from '../UI/FormField';
import ColorPickerField from './ColorPickerField';
import type { TaskTypeOption } from '../../types/models';
import { useI18n } from '../../i18n/useI18n';
import { useCatalogLabel } from '../../hooks/useCatalogLabel';

export interface AreaFormValues {
  name: string;
  colorHex: string;
  defaultTaskType: string | null;
  credits: number | null;
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

const DEFAULT_VALUES: AreaFormValues = { name: '', colorHex: '#8b5cf6', defaultTaskType: null, credits: null };

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
  const { t } = useI18n();
  const { catalogLabel } = useCatalogLabel();
  const [formData, setFormData] = useState<AreaFormValues>(initialValues);

  const handleSubmit = (e: SyntheticEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-2">
      <FormField label={t('ui.areaSubjectName')} htmlFor={`${idPrefix}-name`}>
        <Input
          id={`${idPrefix}-name`}
          required
          type="text"
          placeholder={t('ui.eGMathWebDevelopment')}
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

      <FormField label={t('ui.associatedTypeOptional')} htmlFor={`${idPrefix}-default-type`}>
        <Select
          id={`${idPrefix}-default-type`}
          value={formData.defaultTaskType ?? ''}
          onChange={(e) =>
            setFormData({ ...formData, defaultTaskType: e.target.value || null })
          }
        >
          <option value="">{t('ui.noFixedTypeAskEvery')}</option>
          {taskTypes.map((type) => (
            <option key={type.key} value={type.key}>
              {catalogLabel('taskType', type.key, type.label)}
            </option>
          ))}
        </Select>
        <p className="mt-1 text-xs text-neutral-500">
          {t('ui.ifSetTasksCreatedIn')}
        </p>
      </FormField>

      <FormField label={t('ui.creditsOptional')} htmlFor={`${idPrefix}-credits`}>
        <Input
          id={`${idPrefix}-credits`}
          type="number"
          min={0}
          step={1}
          placeholder="E.g: 6"
          value={formData.credits ?? ''}
          onChange={(e) =>
            setFormData({
              ...formData,
              credits: e.target.value === '' ? null : Number(e.target.value),
            })
          }
          className="w-full"
        />
        <p className="mt-1 text-xs text-neutral-500">
          {t('ui.ectsOrEquivalentLeaveEmpty')}
        </p>
      </FormField>

      <div className="pt-4 flex justify-end gap-3 border-t border-neutral-800 mt-6">
        <Button type="button" variant="secondary" onClick={onCancel}>
          {t('ui.cancel')}
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
