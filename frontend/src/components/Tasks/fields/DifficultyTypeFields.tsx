import FormField from '../../UI/FormField';
import Select from '../../UI/Select';
import type { TaskTypeOption } from '../../../types/models';
import { formatEnumLabel } from '../../../utils/formatEnumLabel';

interface DifficultyTypeFieldsProps {
  idPrefix: string;
  difficulty: string;
  type: string;
  difficulties: string[];
  taskTypes: TaskTypeOption[];
  isTypeLockedByArea: boolean;
  lockedByAreaName?: string;
  onDifficultyChange: (value: string) => void;
  onTypeChange: (value: string) => void;
}

export default function DifficultyTypeFields({
  idPrefix,
  difficulty,
  type,
  difficulties,
  taskTypes,
  isTypeLockedByArea,
  lockedByAreaName,
  onDifficultyChange,
  onTypeChange,
}: DifficultyTypeFieldsProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <FormField label="Difficulty" htmlFor={`${idPrefix}-difficulty`}>
        <Select
          id={`${idPrefix}-difficulty`}
          value={difficulty}
          onChange={(e) => onDifficultyChange(e.target.value)}
          className="w-full"
        >
          {difficulties.map((d) => (
            <option key={d} value={d}>
              {formatEnumLabel(d)}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField label="Type" htmlFor={`${idPrefix}-type`}>
        <Select
          id={`${idPrefix}-type`}
          value={type}
          disabled={isTypeLockedByArea}
          onChange={(e) => onTypeChange(e.target.value)}
          className="w-full"
        >
          <option value="" disabled>
            Select Type...
          </option>
          {taskTypes.map((t) => (
            <option key={t.key} value={t.key}>
              {t.label}
            </option>
          ))}
        </Select>
        {isTypeLockedByArea && (
          <p className="mt-1 text-xs text-neutral-500">
            Set automatically by the "{lockedByAreaName}" Area.
          </p>
        )}
      </FormField>
    </div>
  );
}
