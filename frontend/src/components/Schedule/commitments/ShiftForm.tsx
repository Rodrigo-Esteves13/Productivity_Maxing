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
  submitLabel: string;
  isSaving: boolean;
  onSubmit: (values: ShiftFormValues) => Promise<boolean>;
  onCancel: () => void;
}

const DEFAULT_START = '09:00';
const DEFAULT_END = '17:00';

export default function ShiftForm({ shift, submitLabel, isSaving, onSubmit, onCancel }: ShiftFormProps) {
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
      setFormError('Start must be before end. Split overnight shifts in two.');
      return;
    }
    if (repeat === 'weekly' && days.length === 0) {
      setFormError('Pick at least one weekday.');
      return;
    }
    if (repeat === 'once' && !date) {
      setFormError('Pick a date.');
      return;
    }

    setFormError('');
    await onSubmit({ repeat, days, date, startMinutes, endMinutes });
  };

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3 rounded-lg bg-neutral-800/40 p-3">
      <Select
        label="Repeats"
        value={repeat}
        onChange={(e) => setRepeat(e.target.value as Repeat)}
      >
        <option value="weekly">Every week</option>
        <option value="once">One day only</option>
      </Select>

      {repeat === 'weekly' ? (
        <fieldset>
          <legend className="block text-sm font-medium text-neutral-300 mb-1">
            {isEditing ? 'Day' : 'Days'}
          </legend>
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAYS.map((d) => (
              <ToggleChip key={d.value} size="sm" pressed={days.includes(d.value)} onClick={() => toggleDay(d.value)}>
                {d.label}
              </ToggleChip>
            ))}
          </div>
        </fieldset>
      ) : (
        <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      )}

      <div className="grid grid-cols-2 gap-3">
        <Input label="From" type="time" value={start} onChange={(e) => setStart(e.target.value)} />
        <Input label="To" type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
      </div>

      {formError && <ErrorState message={formError} />}

      <div className="flex gap-2">
        <ActionButton type="submit" disabled={isSaving}>
          {isSaving ? 'Saving...' : submitLabel}
        </ActionButton>
        <button type="button" onClick={onCancel} className="px-3 py-2 text-sm text-neutral-400 hover:text-white">
          Cancel
        </button>
      </div>
    </form>
  );
}
