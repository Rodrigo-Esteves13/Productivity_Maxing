import FormField from '../../UI/FormField';
import Input from '../../UI/Input';
import Select from '../../UI/Select';
import { formatEnumLabel } from '../../../utils/formatEnumLabel';

interface ProgressAndGradeFieldsProps {
  idPrefix: string;
  progressStatus: string;
  realGrade: string;
  progressStatuses: string[];
  showProgressStatus: boolean;
  showRealGrade: boolean;
  onProgressStatusChange: (value: string) => void;
  onRealGradeChange: (value: string) => void;
}

export default function ProgressAndGradeFields({
  idPrefix,
  progressStatus,
  realGrade,
  progressStatuses,
  showProgressStatus,
  showRealGrade,
  onProgressStatusChange,
  onRealGradeChange,
}: ProgressAndGradeFieldsProps) {
  return (
    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-neutral-800">
      {showProgressStatus && (
        <FormField label="Progress" htmlFor={`${idPrefix}-progress-status`}>
          <Select
            id={`${idPrefix}-progress-status`}
            value={progressStatus}
            onChange={(e) => onProgressStatusChange(e.target.value)}
            className="w-full"
          >
            {progressStatuses.map((status) => (
              <option key={status} value={status}>
                {formatEnumLabel(status)}
              </option>
            ))}
          </Select>
        </FormField>
      )}
      {showRealGrade && (
        <FormField label="Real Grade" htmlFor={`${idPrefix}-real-grade`}>
          <Input
            id={`${idPrefix}-real-grade`}
            type="number"
            min="0"
            max="20"
            step="0.1"
            placeholder="Not entered yet"
            value={realGrade}
            onChange={(e) => onRealGradeChange(e.target.value)}
            className="w-full"
          />
        </FormField>
      )}
    </div>
  );
}
