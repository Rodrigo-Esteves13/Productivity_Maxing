import FormField from '../../UI/FormField';
import Input from '../../UI/Input';
import Select from '../../UI/Select';
import { formatEnumLabel } from '../../../utils/formatEnumLabel';

interface ProgressAndGradeFieldsProps {
  idPrefix: string;
  progressStatus: string;
  realGrade: string;
  recalledStudyMinutes: string;
  isPinned: boolean;
  progressStatuses: string[];
  showProgressStatus: boolean;
  showRealGrade: boolean;
  onProgressStatusChange: (value: string) => void;
  onRealGradeChange: (value: string) => void;
  onRecalledStudyMinutesChange: (value: string) => void;
  onIsPinnedChange: (value: boolean) => void;
}

// Estado e acompanhamento da task. O progresso aparece na criacao e na
// edicao; a nota real so na edicao (uma task so ganha nota depois de
// existir). O tempo "de memoria" serve tasks antigas, feitas antes de haver
// sessoes registadas (alimenta as previsoes, ver Task.recalledStudyMinutes).
export default function ProgressAndGradeFields({
  idPrefix,
  progressStatus,
  realGrade,
  recalledStudyMinutes,
  isPinned,
  progressStatuses,
  showProgressStatus,
  showRealGrade,
  onProgressStatusChange,
  onRealGradeChange,
  onRecalledStudyMinutesChange,
  onIsPinnedChange,
}: ProgressAndGradeFieldsProps) {
  return (
    <div className="space-y-4 pt-4 border-t border-neutral-800">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
        <FormField label="Study time already done (minutes)" htmlFor={`${idPrefix}-recalled-minutes`}>
          <Input
            id={`${idPrefix}-recalled-minutes`}
            type="number"
            min="0"
            step="5"
            placeholder="Optional, from memory"
            value={recalledStudyMinutes}
            onChange={(e) => onRecalledStudyMinutesChange(e.target.value)}
            className="w-full"
          />
        </FormField>
      </div>

      <label className="flex items-center gap-2 text-sm text-neutral-300 select-none cursor-pointer">
        <input
          type="checkbox"
          checked={isPinned}
          onChange={(e) => onIsPinnedChange(e.target.checked)}
          className="accent-violet-500"
        />
        Pin this task to the top of the list
      </label>
    </div>
  );
}
