import FormField from '../../UI/FormField';
import Select from '../../UI/Select';
import type { AcademicTaskTypeOption } from '../../../types/models';
import { useI18n } from '../../../i18n/useI18n';

interface AcademicFieldsProps {
  idPrefix: string;
  academicType: string;
  availableAcademicTypes: AcademicTaskTypeOption[];
  onAcademicTypeChange: (value: string) => void;
}

export default function AcademicFields({
  idPrefix,
  academicType,
  availableAcademicTypes,
  onAcademicTypeChange,
}: AcademicFieldsProps) {
  const { t } = useI18n();
  return (
    <FormField label={t('ui.academicType')} htmlFor={`${idPrefix}-academic-type`}>
      <Select
        id={`${idPrefix}-academic-type`}
        value={academicType}
        onChange={(e) => onAcademicTypeChange(e.target.value)}
        className="w-full"
      >
        <option value="">{t('ui.selectAcademicType')}</option>
        {availableAcademicTypes.map((a) => (
          <option key={a.key} value={a.key}>
            {a.label}
          </option>
        ))}
      </Select>
    </FormField>
  );
}
