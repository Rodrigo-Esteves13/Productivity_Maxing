import { useState } from 'react';
import type { FormEvent } from 'react';
import Input from '../../UI/Input';
import Select from '../../UI/Select';
import ActionButton from '../../UI/ActionButton';
import ErrorState from '../../UI/ErrorState';
import { formatClock, parseClock } from '../../../lib/timeFormat';
import { WEEKDAYS } from './shiftText';
import type { WorkShift } from '../../../types/models';
import ToggleChip from '../../UI/ToggleChip';
import { useI18n } from '../../../i18n/useI18n';

type Repeat = 'weekly' | 'once';

export interface ShiftFormValues {
  repeat: Repeat;
  days: number[];
  date: string;
  startMinutes: number;
  endMinutes: number;
}

interface ShiftFormProps {
  // Presente = a editar esse turno (um só dia); ausente = a criar (vários dias).
  shift?: WorkShift;
  // Folgas fixas do local: esses dias da semana nao se podem escolher.
  disabledDays?: number[];
  submitLabel: string;
  isSaving: boolean;
  onSubmit: (values: ShiftFormValues) => Promise<boolean>;
  onCancel: () => void;
}

const DEFAULT_START = '09:00';
const DEFAULT_END = '17:00';

export default function ShiftForm({
  shift,
  disabledDays = [],
  submitLabel,
  isSaving,
  onSubmit,
  onCancel,
}: ShiftFormProps) {
  const { t } = useI18n();
  const isEditing = shift !== undefined;
  const [repeat, setRepeat] = useState<Repeat>(shift && shift.dayOfWeek === null ? 'once' : 'weekly');
  const [days, setDays] = useState<number[]>(shift?.dayOfWeek != null ? [shift.dayOfWeek] : []);
  const [date, setDate] = useState(shift?.date ? shift.date.slice(0, 10) : '');
  const [start, setStart] = useState(shift ? formatClock(shift.startMinutes) : DEFAULT_START);
  const [end, setEnd] = useState(shift ? formatClock(shift.endMinutes) : DEFAULT_END);
  const [formError, setFormError] = useState('');

  const toggleDay = (value: number) =>
    setDays((prev) => {
      // A editar há um só dia; a criar podem ser vários.
      if (isEditing) return [value];
      return prev.includes(value) ? prev.filter((d) => d !== value) : [...prev, value];
    });

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const startMinutes = parseClock(start);
    const endMinutes = parseClock(end);

    if (startMinutes === null || endMinutes === null || startMinutes >= endMinutes) {
      setFormError(t('ui.startMustBeBeforeEnd2'));
      return;
    }
    if (repeat === 'weekly' && days.length === 0) {
      setFormError(t('ui.pickAtLeastOneWeekday'));
      return;
    }
    if (repeat === 'weekly' && days.some((d) => disabledDays.includes(d))) {
      setFormError(t('ui.thatWeekdayIsAFixed'));
      return;
    }
    if (repeat === 'once' && !date) {
      setFormError(t('ui.pickADate'));
      return;
    }

    setFormError('');
    await onSubmit({ repeat, days, date, startMinutes, endMinutes });
  };

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3 rounded-lg bg-neutral-800/40 p-3">
      <Select
        label={t('ui.repeats')}
        value={repeat}
        onChange={(e) => setRepeat(e.target.value as Repeat)}
      >
        <option value="weekly">{t('ui.everyWeek')}</option>
        <option value="once">{t('ui.oneDayOnly')}</option>
      </Select>

      {repeat === 'weekly' ? (
        <fieldset>
          <legend className="block text-sm font-medium text-neutral-300 mb-1">
            {isEditing ? t('ui.day') : t('ui.days')}
          </legend>
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAYS.map((d) => (
              <ToggleChip
                key={d.value}
                size="sm"
                pressed={days.includes(d.value)}
                disabled={disabledDays.includes(d.value) && !days.includes(d.value)}
                title={disabledDays.includes(d.value) ? t('ui.fixedDayOff') : undefined}
                onClick={() => toggleDay(d.value)}
              >
                {d.label}
              </ToggleChip>
            ))}
          </div>
        </fieldset>
      ) : (
        <Input label={t('ui.date')} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      )}

      <div className="grid grid-cols-2 gap-3">
        <Input label={t('ui.from')} type="time" value={start} onChange={(e) => setStart(e.target.value)} />
        <Input label={t('ui.to')} type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
      </div>

      {formError && <ErrorState message={formError} />}

      <div className="flex gap-2">
        <ActionButton type="submit" disabled={isSaving}>
          {isSaving ? t('common.saving') : submitLabel}
        </ActionButton>
        <button type="button" onClick={onCancel} className="px-3 py-2 text-sm text-neutral-400 hover:text-white">
          {t('ui.cancel')}
        </button>
      </div>
    </form>
  );
}
