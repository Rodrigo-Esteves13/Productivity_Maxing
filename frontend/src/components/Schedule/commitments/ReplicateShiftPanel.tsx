import { MS_PER_DAY } from '../../../lib/timeConstants';
import { useMemo, useState } from 'react';
import ActionButton from '../../UI/ActionButton';
import ToggleChip from '../../UI/ToggleChip';
import { formatDayLabel } from '../../../lib/timeFormat';
import { WEEKDAYS } from './shiftText';
import type { CreateWorkShiftInput, WorkShift } from '../../../types/models';
import { useI18n } from '../../../i18n/useI18n';

interface ReplicateShiftPanelProps {
  shift: WorkShift;
  // Folgas fixas do local: nao se pode replicar para esses dias.
  disabledDays?: number[];
  isSaving: boolean;
  onReplicate: (inputs: CreateWorkShiftInput[]) => Promise<boolean>;
  onClose: () => void;
}

const FOLLOWING_DAYS = 7;
const NO_DAYS_OFF: number[] = [];

function addDaysKey(dateKey: string, days: number): string {
  return new Date(Date.parse(dateKey) + days * MS_PER_DAY).toISOString().slice(0, 10);
}

// Copia este turno (mesmas horas, mesmo local/titulo) para outros dias, sem
// reescrever tudo: semanal -> escolhe os outros dias da semana; pontual ->
// escolhe entre os 7 dias seguintes.
export default function ReplicateShiftPanel({
  shift,
  disabledDays = NO_DAYS_OFF,
  isSaving,
  onReplicate,
  onClose,
}: ReplicateShiftPanelProps) {
  const { t } = useI18n();
  const isWeekly = shift.dayOfWeek !== null;
  const baseDate = shift.date ? shift.date.slice(0, 10) : null;
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [offsets, setOffsets] = useState<number[]>([]);

  const followingDays = useMemo(
    () =>
      baseDate
        ? Array.from({ length: FOLLOWING_DAYS }, (_, i) => {
            const key = addDaysKey(baseDate, i + 1);
            // Dia da semana da data (UTC, como o resto das datas-chave).
            const isDayOff = disabledDays.includes(new Date(Date.parse(key)).getUTCDay());
            return { offset: i + 1, key, label: formatDayLabel(key), isDayOff };
          })
        : [],
    [baseDate, disabledDays],
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
      ? weekdays.map((dayOfWeek) => ({
          ...base,
          dayOfWeek,
          ...(shift.startsOn && { startsOn: shift.startsOn.slice(0, 10) }),
        }))
      : followingDays.filter((d) => offsets.includes(d.offset)).map((d) => ({ ...base, date: d.key }));
    if (inputs.length === 0) return;
    if (await onReplicate(inputs)) onClose();
  };

  return (
    <div className="mt-2 space-y-2 rounded-lg bg-neutral-800/40 p-3">
      <p className="text-xs text-neutral-400">
        {isWeekly ? t('ui.copyThisShiftToOther2') : t('ui.copyThisShiftToThe')}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {isWeekly
          ? WEEKDAYS.filter((d) => d.value !== shift.dayOfWeek).map((d) => (
              <ToggleChip
                key={d.value}
                size="sm"
                pressed={weekdays.includes(d.value)}
                disabled={disabledDays.includes(d.value)}
                title={disabledDays.includes(d.value) ? t('ui.fixedDayOff') : undefined}
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
                disabled={d.isDayOff}
                title={d.isDayOff ? t('ui.fixedDayOff') : undefined}
                onClick={() => toggle(offsets, d.offset, setOffsets)}
              >
                {d.label}
              </ToggleChip>
            ))}
      </div>
      <div className="flex gap-2">
        <ActionButton type="button" disabled={isSaving || count === 0} onClick={() => void handleSubmit()}>
          {isSaving ? t('ui.copying') : count > 1 ? t('ui.copyToNDays', { count }) : t('ui.copy')}
        </ActionButton>
        <button type="button" onClick={onClose} className="px-3 py-2 text-sm text-neutral-400 hover:text-white">
          {t('ui.cancel')}
        </button>
      </div>
    </div>
  );
}
