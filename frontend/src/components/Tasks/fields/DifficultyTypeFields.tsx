import FormField from '../../UI/FormField';
import Select from '../../UI/Select';
import type { TaskTypeOption, PriorityOption } from '../../../types/models';
import { useEnumLabel } from '../../../hooks/useEnumLabel';
import { useI18n } from '../../../i18n/useI18n';

interface DifficultyTypeFieldsProps {
  idPrefix: string;
  difficulty: string;
  priority: string;
  type: string;
  difficulties: string[];
  priorities: PriorityOption[];
  taskTypes: TaskTypeOption[];
  isTypeLockedByArea: boolean;
  lockedByAreaName?: string;
  onDifficultyChange: (value: string) => void;
  onPriorityChange: (value: string) => void;
  onTypeChange: (value: string) => void;
  onClearArea?: () => void;
}

export default function DifficultyTypeFields({
  idPrefix,
  difficulty,
  priority,
  type,
  difficulties,
  priorities,
  taskTypes,
  isTypeLockedByArea,
  lockedByAreaName,
  onDifficultyChange,
  onPriorityChange,
  onTypeChange,
  onClearArea,
}: DifficultyTypeFieldsProps) {
  const { t } = useI18n();
  const enumLabel = useEnumLabel();
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <FormField label={t('filters.difficulty')} htmlFor={`${idPrefix}-difficulty`}>
        <Select
          id={`${idPrefix}-difficulty`}
          value={difficulty}
          onChange={(e) => onDifficultyChange(e.target.value)}
          className="w-full"
        >
          {difficulties.map((d) => (
            <option key={d} value={d}>
              {enumLabel(d)}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField label={t('tasks.col.priority')} htmlFor={`${idPrefix}-priority`}>
        <Select
          id={`${idPrefix}-priority`}
          value={priority}
          onChange={(e) => onPriorityChange(e.target.value)}
          className="w-full"
        >
          <option value="">{t('taskForm.noPriority')}</option>
          {priorities.map((p) => (
            <option key={p.key} value={p.key}>
              {p.label}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField label={t('taskForm.type')} htmlFor={`${idPrefix}-type`}>
        <Select
          id={`${idPrefix}-type`}
          value={type}
          disabled={isTypeLockedByArea}
          onChange={(e) => onTypeChange(e.target.value)}
          className="w-full"
        >
          <option value="" disabled>
            {t('taskForm.selectType')}
          </option>
          {taskTypes.map((taskType) => (
            <option key={taskType.key} value={taskType.key}>
              {taskType.label}
            </option>
          ))}
        </Select>
        {isTypeLockedByArea && (
          <p className="mt-1 text-xs text-neutral-500">
            {t('taskForm.lockedByArea', { area: lockedByAreaName ?? '' })}{' '}
            {onClearArea && (
              <button
                type="button"
                onClick={onClearArea}
                className="text-violet-400 hover:text-violet-300 underline underline-offset-2"
              >
                {t('taskForm.changeArea')}
              </button>
            )}
          </p>
        )}
      </FormField>
    </div>
  );
}
