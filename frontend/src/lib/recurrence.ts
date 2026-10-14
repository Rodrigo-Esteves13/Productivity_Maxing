import type { RecurrenceFrequency, Task } from '../types/models';

export interface RecurrenceValue {
  frequency: '' | RecurrenceFrequency;
  interval: string; // numero como texto (input)
  until: string; // "YYYY-MM-DD" ou ''
}

export const EMPTY_RECURRENCE: RecurrenceValue = { frequency: '', interval: '1', until: '' };

export const RECURRENCE_UNIT: Record<RecurrenceFrequency, string> = {
  DAILY: 'day(s)',
  WEEKLY: 'week(s)',
  MONTHLY: 'month(s)',
};

const MAX_RECURRENCE_INTERVAL = 365;

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
  const interval = Math.min(MAX_RECURRENCE_INTERVAL, Math.max(1, Math.floor(Number(value.interval)) || 1));
  return {
    recurrenceFrequency: value.frequency,
    recurrenceInterval: interval,
    recurrenceUntil: value.until ? `${value.until}T00:00:00.000Z` : forEdit ? null : undefined,
  };
}

// Texto curto para badge/detalhe: "Repeats every 2 weeks".
export function recurrenceLabel(task: Pick<Task, 'recurrenceFrequency' | 'recurrenceInterval'>): string | null {
  if (!task.recurrenceFrequency) return null;
  const interval = task.recurrenceInterval ?? 1;
  const unit = RECURRENCE_UNIT[task.recurrenceFrequency].replace('(s)', interval === 1 ? '' : 's');
  return interval === 1 ? `Repeats every ${unit}` : `Repeats every ${interval} ${unit}`;
}
