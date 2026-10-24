// Modelos de task guardados so neste browser (localStorage, ver
// useTaskTemplates). Guardam o que se repete de task para task (Area, tipo,
// dificuldade, peso, checklist, repeticao), nunca a data nem a nota.
export const MAX_TASK_TEMPLATES = 30;
export const MAX_TEMPLATE_NAME_LENGTH = 60;
// Mesmo limite da checklist do formulario (TaskForm corta em 100 passos).
const MAX_CHECKLIST_LENGTH = 100 * 201;

// Campos do formulario que um modelo pode trazer. Lista fechada: o que vier
// do localStorage fora disto e ignorado.
export const TEMPLATE_FIELDS = [
  'title',
  'type',
  'academicType',
  'difficulty',
  'priority',
  'areaId',
  'topics',
  'referenceLink',
  'notes',
  'targetGrade',
  'weightPercentage',
  'estimatedMinutes',
] as const;

export type TemplateField = (typeof TEMPLATE_FIELDS)[number];
const RECURRENCE_FREQUENCIES = ['', 'DAILY', 'WEEKLY', 'MONTHLY'] as const;

export interface TaskTemplate {
  id: string;
  name: string;
  fields: Partial<Record<TemplateField, string>>;
  checklist: string;
  recurrence: { frequency: (typeof RECURRENCE_FREQUENCIES)[number]; interval: string };
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

function sanitizeTemplate(raw: unknown): TaskTemplate | null {
  if (!isRecord(raw) || typeof raw.id !== 'string' || typeof raw.name !== 'string') return null;
  const name = raw.name.trim().slice(0, MAX_TEMPLATE_NAME_LENGTH);
  if (!name) return null;
  const rawFields = isRecord(raw.fields) ? raw.fields : {};
  const fields: TaskTemplate['fields'] = {};
  for (const key of TEMPLATE_FIELDS) {
    const value = rawFields[key];
    if (typeof value === 'string') fields[key] = value;
  }
  const rawRecurrence = isRecord(raw.recurrence) ? raw.recurrence : {};
  const frequency = RECURRENCE_FREQUENCIES.find((f) => f === rawRecurrence.frequency) ?? '';
  const interval = typeof rawRecurrence.interval === 'string' ? rawRecurrence.interval : '1';
  return {
    id: raw.id,
    name,
    fields,
    checklist: typeof raw.checklist === 'string' ? raw.checklist.slice(0, MAX_CHECKLIST_LENGTH) : '',
    recurrence: { frequency, interval },
  };
}

// Le e valida o que esta guardado (pode ter sido mexido a mao ou vir de uma
// versao antiga): entradas invalidas saem, o resto fica.
export function parseStoredTemplates(raw: string | null): TaskTemplate[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(sanitizeTemplate)
      .filter((t): t is TaskTemplate => t !== null)
      .slice(0, MAX_TASK_TEMPLATES);
  } catch {
    return [];
  }
}

// So os campos do modelo, a partir dos valores atuais do formulario.
export function pickTemplateFields(values: Record<string, unknown>): TaskTemplate['fields'] {
  const fields: TaskTemplate['fields'] = {};
  for (const key of TEMPLATE_FIELDS) {
    const value = values[key];
    if (typeof value === 'string' && value !== '') fields[key] = value;
  }
  return fields;
}

// Campos a aplicar ao formulario. Uma Area que ja nao existe (apagada ou
// escondida) nao e aplicada, para o formulario nao ficar com um id fantasma.
export function templateFieldsFor(template: TaskTemplate, validAreaIds: Set<string>): TaskTemplate['fields'] {
  const { areaId, ...rest } = template.fields;
  return areaId && validAreaIds.has(areaId) ? { ...rest, areaId } : rest;
}
