// Formatacao do historico de alteracoes de uma task. Puro: recebe as
// funcoes de traducao e de data em vez de as importar.
export interface TaskChange {
  id: string;
  field: string;
  fromValue: string | null;
  toValue: string | null;
  createdAt: string;
}

// Espelha TRACKED_TASK_FIELDS do backend (tasks/task-change-diff.ts).
export const TRACKED_FIELDS = [
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

const DATE_FIELDS: readonly string[] = ['date', 'availableFrom'];
const BOOLEAN_FIELDS: readonly string[] = ['isBlocked', 'isPinned'];
const ENUM_FIELDS: readonly string[] = ['progressStatus', 'dateCertainty'];
// Ids que nao dizem nada ao user: so se mostra que mudou.
const OPAQUE_FIELDS: readonly string[] = ['areaId'];

export interface FormatDeps {
  t: (key: string) => string;
  enumLabel: (value: string) => string;
  formatDate: (iso: string) => string;
}

export function isOpaqueField(field: string): boolean {
  return OPAQUE_FIELDS.includes(field);
}

export function formatChangeValue(field: string, value: string | null, deps: FormatDeps): string {
  if (value === null || value === '') return deps.t('taskHistory.empty');
  if (DATE_FIELDS.includes(field)) return deps.formatDate(value);
  if (BOOLEAN_FIELDS.includes(field)) return deps.t(value === 'true' ? 'taskHistory.yes' : 'taskHistory.no');
  if (ENUM_FIELDS.includes(field)) return deps.enumLabel(value);
  return value;
}
