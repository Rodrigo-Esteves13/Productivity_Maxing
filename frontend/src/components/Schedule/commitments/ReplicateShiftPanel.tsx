import { useMemo, useState } from 'react';
import ActionButton from '../../UI/ActionButton';
import ToggleChip from '../../UI/ToggleChip';
import { formatDayLabel } from '../../../lib/timeFormat';
import { WEEKDAYS } from './shiftText';
import type { CreateWorkShiftInput, WorkShift } from '../../../types/models';

interface ReplicateShiftPanelProps {
  shift: WorkShift;
  isSaving: boolean;
  onReplicate: (inputs: CreateWorkShiftInput[]) => Promise<boolean>;
  onClose: () => void;
}

const FOLLOWING_DAYS = 7;
const MS_PER_DAY = 86_400_000;

function addDaysKey(dateKey: string, days: number): string {
  return new Date(Date.parse(dateKey) + days * MS_PER_DAY).toISOString().slice(0, 10);
}

// Copia este turno (mesmas horas, mesmo local/titulo) para outros dias, sem
// reescrever tudo: semanal -> escolhe os outros dias da semana; pontual ->
// escolhe entre os 7 dias seguintes.
export default function ReplicateShiftPanel({ shift, isSaving, onReplicate, onClose }: ReplicateShiftPanelProps) {
  const isWeekly = shift.dayOfWeek !== null;
  const baseDate = shift.date ? shift.date.slice(0, 10) : null;
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [offsets, setOffsets] = useState<number[]>([]);

  const followingDays = useMemo(
    () =>
      baseDate
        ? Array.from({ length: FOLLOWING_DAYS }, (_, i) => {
            const key = addDaysKey(baseDate, i + 1);
            return { offset: i + 1, key, label: formatDayLabel(key) };
          })
        : [],
    [baseDate],
  );

  const toggle = (list: number[], value: number, set: (next: number[]) => void) =>
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  const count = isWeekly ? weekdays.length : offsets.length;

  const handleSubmit = async () => {
    // Turnos de um local herdam o nome e o trajeto dele; soltos levam o
    // proprio titulo e margem.
    const base: Omit<CreateWorkShiftInput, 'dayOfWeek' | 'date'> = {
      startMinutes: shift.startMinutes,
      endMinutes: shift.endMinutes,
      ...(shift.commitmentId
        ? { commitmentId: shift.commitmentId }
        : { bufferMinutes: shift.bufferMinutes, ...(shift.label ? { label: shift.label } : {}) }),
    };
    const inputs: CreateWorkShiftInput[] = isWeekly
      ? weekdays.map((dayOfWeek) => ({ ...base, dayOfWeek }))
      : followingDays.filter((d) => offsets.includes(d.offset)).map((d) => ({ ...base, date: d.key }));
    if (inputs.length === 0) return;
    if (await onReplicate(inputs)) onClose();
  };

  return (
    <div className="mt-2 space-y-2 rounded-lg bg-neutral-800/40 p-3">
      <p className="text-xs text-neutral-400">
        {isWeekly ? 'Copy this shift to other weekdays:' : 'Copy this shift to the following days:'}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {isWeekly
          ? WEEKDAYS.filter((d) => d.value !== shift.dayOfWeek).map((d) => (
              <ToggleChip
                key={d.value}
                size="sm"
                pressed={weekdays.includes(d.value)}
                onClick={() => toggle(weekdays, d.value, setWeekdays)}
              >
                {d.label}
              </ToggleChip>
            ))
          : followingDays.map((d) => (
              <ToggleChip
                key={d.offset}
                size="sm"
                pressed={offsets.includes(d.offset)}
                onClick={() => toggle(offsets, d.offset, setOffsets)}
              >
                {d.label}
              </ToggleChip>
            ))}
      </div>
      <div className="flex gap-2">
        <ActionButton type="button" disabled={isSaving || count === 0} onClick={() => void handleSubmit()}>
          {isSaving ? 'Copying...' : count > 1 ? `Copy to ${count} days` : 'Copy'}
        </ActionButton>
        <button type="button" onClick={onClose} className="px-3 py-2 text-sm text-neutral-400 hover:text-white">
          Cancel
        </button>
      </div>
    </div>
  );
}
