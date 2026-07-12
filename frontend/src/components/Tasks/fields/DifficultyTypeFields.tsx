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
  // Antes isto "destrancava" o Type mantendo a Area escolhida, o que
  // permitia uma combinação Type != Area.defaultTaskType - inválida
  // (a Area tem literalmente um TaskType associado, uma Task nessa Area
  // com Type diferente não faz sentido de dados). O botão passa a limpar
  // só a Area, nada mais: sem Area escolhida, o Type deixa de estar
  // trancado por natureza (useTaskTypeLogic), sem abrir a porta a
  // inconsistências.
  onClearArea?: () => void;
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
  onClearArea,
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
            Set automatically by the "{lockedByAreaName}" Area.{' '}
            {onClearArea && (
              <button
                type="button"
                onClick={onClearArea}
                className="text-violet-400 hover:text-violet-300 underline underline-offset-2"
              >
                Change Area
              </button>
            )}
          </p>
        )}
      </FormField>
    </div>
  );
}
