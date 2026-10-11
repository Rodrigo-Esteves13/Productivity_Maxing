import type { RecurrenceFrequency, Task } from '../../types/models';

export interface RecurrenceValue {
  frequency: '' | RecurrenceFrequency;
  interval: string; // numero como texto (input)
  until: string; // "YYYY-MM-DD" ou ''
}

export const EMPTY_RECURRENCE: RecurrenceValue = { frequency: '', interval: '1', until: '' };

export function recurrenceFromTask(task: Task): RecurrenceValue {
  return {
    frequency: task.recurrenceFrequency ?? '',
    interval: String(task.recurrenceInterval ?? 1),
    until: task.recurrenceUntil ? task.recurrenceUntil.split('T')[0] : '',
  };
}

// Campos para o corpo de POST/PATCH. `forEdit`: no PATCH tem de ir null
// para DESLIGAR a repeticao; na criacao sem repeticao nao se manda nada.
export function recurrencePayload(value: RecurrenceValue, forEdit: boolean) {
  if (!value.frequency) {
    return forEdit ? { recurrenceFrequency: null, recurrenceUntil: null } : {};
  }
  const interval = Math.min(365, Math.max(1, Math.floor(Number(value.interval)) || 1));
  return {
    recurrenceFrequency: value.frequency,
    recurrenceInterval: interval,
    recurrenceUntil: value.until ? `${value.until}T00:00:00.000Z` : forEdit ? null : undefined,
  };
}

const UNIT: Record<RecurrenceFrequency, string> = { DAILY: 'day(s)', WEEKLY: 'week(s)', MONTHLY: 'month(s)' };

interface RecurrenceFieldsProps {
  idPrefix: string;
  value: RecurrenceValue;
  onChange: (value: RecurrenceValue) => void;
}

// "Repetir": ao concluir a task cria-se a proxima ocorrencia.
export default function RecurrenceFields({ idPrefix, value, onChange }: RecurrenceFieldsProps) {
  const inputClass =
    'rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm text-neutral-200 focus:outline-none focus:border-violet-600';

  return (
    <div className="space-y-2">
      <label htmlFor={`${idPrefix}-repeat`} className="block text-sm font-medium text-neutral-300">
        Repeat <span className="text-neutral-500 font-normal">(next one is created when you complete this)</span>
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <select
          id={`${idPrefix}-repeat`}
          value={value.frequency}
          onChange={(e) => onChange({ ...value, frequency: e.target.value as RecurrenceValue['frequency'] })}
          className={inputClass}
        >
          <option value="">Does not repeat</option>
          <option value="DAILY">Daily</option>
          <option value="WEEKLY">Weekly</option>
          <option value="MONTHLY">Monthly</option>
        </select>
        {value.frequency && (
          <>
            <span className="text-sm text-neutral-400">every</span>
            <input
              type="number"
              min={1}
              max={365}
              value={value.interval}
              onChange={(e) => onChange({ ...value, interval: e.target.value })}
              aria-label="Repeat interval"
              className={`${inputClass} w-20`}
            />
            <span className="text-sm text-neutral-400">{UNIT[value.frequency]}, until</span>
            <input
              type="date"
              value={value.until}
              onChange={(e) => onChange({ ...value, until: e.target.value })}
              aria-label="Repeat until (optional)"
              className={inputClass}
            />
          </>
        )}
      </div>
    </div>
  );
}
