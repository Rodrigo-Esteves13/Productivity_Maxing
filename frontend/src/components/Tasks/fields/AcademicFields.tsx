import FormField from '../../UI/FormField';
import Input from '../../UI/Input';
import Select from '../../UI/Select';
import type { AcademicTaskTypeOption } from '../../../types/models';

interface AcademicFieldsProps {
  idPrefix: string;
  academicType: string;
  targetGrade: string;
  weightPercentage: string;
  availableAcademicTypes: AcademicTaskTypeOption[];
  onAcademicTypeChange: (value: string) => void;
  onTargetGradeChange: (value: string) => void;
  onWeightPercentageChange: (value: string) => void;
}

export default function AcademicFields({
  idPrefix,
  academicType,
  targetGrade,
  weightPercentage,
  availableAcademicTypes,
  onAcademicTypeChange,
  onTargetGradeChange,
  onWeightPercentageChange,
}: AcademicFieldsProps) {
  return (
    <>
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

      <div className="space-y-4 pt-4 border-t border-neutral-800">
        <p className="text-xs font-semibold text-neutral-500 uppercase">Academic Details</p>
        <div className="grid grid-cols-2 gap-4">
          <Input
            type="number"
            min="0"
            max="20"
            step="0.1"
            placeholder="Target Grade"
            value={targetGrade}
            onChange={(e) => onTargetGradeChange(e.target.value)}
            className="w-full"
          />
          <Input
            type="number"
            min="0"
            max="100"
            step="0.1"
            placeholder="Weight (%)"
            value={weightPercentage}
            onChange={(e) => onWeightPercentageChange(e.target.value)}
            className="w-full"
          />
        </div>
      </div>
    </>
  );
}
