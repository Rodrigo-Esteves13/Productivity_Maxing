import FormField from '../../UI/FormField';
import Select from '../../UI/Select';
import type { AcademicTaskTypeOption } from '../../../types/models';

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
  return (
    <FormField label="Academic Type" htmlFor={`${idPrefix}-academic-type`}>
      <Select
        id={`${idPrefix}-academic-type`}
        value={academicType}
        onChange={(e) => onAcademicTypeChange(e.target.value)}
        className="w-full"
      >
        <option value="">Select Academic Type...</option>
        {availableAcademicTypes.map((a) => (
          <option key={a.key} value={a.key}>
            {a.label}
          </option>
        ))}
      </Select>
    </FormField>
  );
}
