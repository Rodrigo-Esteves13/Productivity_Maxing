import { useMemo, useState } from 'react';
import Select from '../../UI/Select';
import ActionButton from '../../UI/ActionButton';
import { weekStartKeys } from '../../../lib/weekDates';
import {
  describeCopyResult,
  describeWeek,
  MODE_OPTIONS,
  SOURCE_WEEKS,
  TARGET_WEEKS,
} from './copyWeekText';
import type { CopyWeekInput, CopyWeekMode, CopyWeekResult } from '../../../types/models';
import ToggleChip from '../../UI/ToggleChip';

interface CopyWeekPanelProps {
  isSaving: boolean;
  result: CopyWeekResult | null;
  onCopy: (input: CopyWeekInput) => Promise<boolean>;
  onClose: () => void;
}

export default function CopyWeekPanel({ isSaving, result, onCopy, onClose }: CopyWeekPanelProps) {
  const sourceWeeks = useMemo(
    () => weekStartKeys(SOURCE_WEEKS.firstOffset, SOURCE_WEEKS.count).reverse(),
    [],
  );
  const targetWeeks = useMemo(
    () => weekStartKeys(TARGET_WEEKS.firstOffset, TARGET_WEEKS.count),
    [],
  );

  const [mode, setMode] = useState<CopyWeekMode>('one-off');
  const [from, setFrom] = useState(sourceWeeks[0].value);
  // Por omissão copia para a semana seguinte (a primeira opção é a atual).
  const [to, setTo] = useState(targetWeeks[1].value);

  const isFixed = mode === 'fixed';
  const activeHint = MODE_OPTIONS.find((option) => option.value === mode)?.hint;

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 mb-4 space-y-3">
      <fieldset>
        <legend className="block text-sm font-medium text-neutral-300 mb-1.5">
          What should happen to that week
        </legend>
        <div className="flex flex-wrap gap-1.5">
          {MODE_OPTIONS.map((option) => (
            <ToggleChip key={option.value} pressed={mode === option.value} onClick={() => setMode(option.value)}>
              {option.label}
            </ToggleChip>
          ))}
        </div>
        <p className="text-xs text-neutral-500 mt-1.5">{activeHint}</p>
      </fieldset>

      <div className={`grid gap-3 ${isFixed ? 'grid-cols-1' : 'sm:grid-cols-2'}`}>
        <Select label="Copy from" value={from} onChange={(e) => setFrom(e.target.value)}>
          {sourceWeeks.map((week) => (
            <option key={week.value} value={week.value}>
              {describeWeek(week.value, week.weeksFromNow)}
            </option>
          ))}
        </Select>
        {!isFixed && (
          <Select label="Copy into" value={to} onChange={(e) => setTo(e.target.value)}>
            {targetWeeks.map((week) => (
              <option key={week.value} value={week.value}>
                {describeWeek(week.value, week.weeksFromNow)}
              </option>
            ))}
          </Select>
        )}
      </div>

      {result && (
        <p role="status" className="text-sm text-neutral-300">
          {describeCopyResult(result)}
        </p>
      )}

      <div className="flex gap-2">
        <ActionButton
          disabled={isSaving}
          onClick={() => void onCopy({ fromWeekStart: from, mode, ...(isFixed ? {} : { toWeekStart: to }) })}
        >
          {isSaving ? 'Copying...' : isFixed ? 'Make fixed' : 'Copy week'}
        </ActionButton>
        <button type="button" onClick={onClose} className="px-3 py-2 text-sm text-neutral-400 hover:text-white">
          Close
        </button>
      </div>
    </div>
  );
}
