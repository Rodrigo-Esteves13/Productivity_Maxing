// Historico de alteracoes de uma task: compara a task antes e depois de um
// PATCH e devolve uma linha por campo que mudou. Puro, sem BD.

// Campos acompanhados (os que o user reconhece como "mudei isto"). Nunca
// renomear: o nome fica guardado em TaskChange.field e e traduzido no frontend.
export const TRACKED_TASK_FIELDS = [
  'title',
  'date',
  'progressStatus',
  'areaId',
  'weightPercentage',
  'targetGrade',
  'realGrade',
  'dateCertainty',
  'isBlocked',
  'availableFrom',
  'isPinned',
] as const;

export type TrackedTaskField = (typeof TRACKED_TASK_FIELDS)[number];

export type TaskSnapshot = Partial<
  Record<TrackedTaskField, string | number | boolean | Date | null>
>;

export interface TaskChangeRow {
  field: TrackedTaskField;
  fromValue: string | null;
  toValue: string | null;
}

// Valores longos (titulos) ficam cortados: o historico e para ler, nao para
// guardar o texto inteiro.
export const CHANGE_VALUE_MAX = 200;

export function stringifyChangeValue(
  value: string | number | boolean | Date | null | undefined,
): string | null {
  if (value === null || value === undefined) return null;
  const text = value instanceof Date ? value.toISOString() : String(value);
  return text.slice(0, CHANGE_VALUE_MAX);
}

export function diffTaskFields(
  before: TaskSnapshot,
  after: TaskSnapshot,
): TaskChangeRow[] {
  const rows: TaskChangeRow[] = [];
  for (const field of TRACKED_TASK_FIELDS) {
    const from = stringifyChangeValue(before[field]);
    const to = stringifyChangeValue(after[field]);
    if (from !== to) rows.push({ field, fromValue: from, toValue: to });
  }
  return rows;
}
