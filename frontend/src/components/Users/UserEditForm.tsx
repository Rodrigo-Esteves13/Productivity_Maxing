import { useState, type SyntheticEvent } from 'react';
import Input from '../UI/Input';
import Select from '../UI/Select';
import Button from '../UI/Button';
import FormField from '../UI/FormField';
import type { Role } from '../../types/models';
import { useI18n } from '../../i18n/useI18n';

export interface UserFormValues {
  name: string;
  role: Role;
}

interface UserEditFormProps {
  idPrefix: string;
  initialValues: UserFormValues;
  isSelf: boolean;
  onSubmit: (values: UserFormValues) => Promise<void> | void;
  onCancel: () => void;
  isSubmitting: boolean;
}

export default function UserEditForm({
  idPrefix,
  initialValues,
  isSelf,
  onSubmit,
  onCancel,
  isSubmitting,
}: UserEditFormProps) {
  const { t } = useI18n();
  const [formData, setFormData] = useState<UserFormValues>(initialValues);

  const handleSubmit = (e: SyntheticEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-2">
      <FormField label={t('ui.name')} htmlFor={`${idPrefix}-name`}>
        <Input
          id={`${idPrefix}-name`}
          required
          type="text"
          placeholder={t('ui.fullName')}
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        />
      </FormField>

      <FormField label={t('ui.role')} htmlFor={`${idPrefix}-role`}>
        <Select
          id={`${idPrefix}-role`}
          value={formData.role}
          disabled={isSelf}
          onChange={(e) => setFormData({ ...formData, role: e.target.value as Role })}
        >
          <option value="USER">{t('ui.user')}</option>
          <option value="ADMIN">{t('ui.admin')}</option>
        </Select>
        {isSelf && (
          <p className="mt-1 text-xs text-neutral-500">
            {t('ui.youCanTChangeYour')}
          </p>
        )}
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
          {isSubmitting ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
}
