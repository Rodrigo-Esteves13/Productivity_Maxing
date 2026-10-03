import { addUtcDays, diffUtcDays, toDateKey } from '../common/date-key.util';
import type { CopyWeekMode } from './work-shifts.constants';

// Campos de um turno que interessam para copiar (sem ids nem donos).
export interface ShiftSource {
  commitmentId: string | null;
  label: string | null;
  bufferMinutes: number;
  date: Date;
  startMinutes: number;
  endMinutes: number;
}

// Um turno por criar: ou semanal (dayOfWeek) ou pontual (dateKey).
export interface ShiftDraft {
  commitmentId: string | null;
  label: string | null;
  bufferMinutes: number;
  dayOfWeek: number | null;
  dateKey: string | null;
  startMinutes: number;
  endMinutes: number;
}

interface CopyContext {
  fromWeekStart: Date;
  toWeekStart: Date;
}

// Tabela em vez de if/switch: cada modo diz como um turno de origem vira
// um rascunho. Acrescentar um modo é acrescentar uma linha.
const DRAFT_BUILDERS: Record<
  CopyWeekMode,
  (source: ShiftSource, context: CopyContext) => ShiftDraft
> = {
  'one-off': (source, { fromWeekStart, toWeekStart }) => {
    const offset = diffUtcDays(fromWeekStart, source.date);
    return {
      ...baseFields(source),
      dayOfWeek: null,
      dateKey: toDateKey(addUtcDays(toWeekStart, offset)),
    };
  },
  fixed: (source) => ({
    ...baseFields(source),
    dayOfWeek: source.date.getUTCDay(),
    dateKey: null,
  }),
};

function baseFields(source: ShiftSource) {
  return {
    commitmentId: source.commitmentId,
    label: source.label,
    bufferMinutes: source.bufferMinutes,
    startMinutes: source.startMinutes,
    endMinutes: source.endMinutes,
  };
}

// Dois turnos são "o mesmo" se tiverem o mesmo local (ou nome), o mesmo
// dia e as mesmas horas. Serve para nunca duplicar ao copiar duas vezes.
export function shiftIdentity(draft: ShiftDraft): string {
  const place = draft.commitmentId ?? draft.label ?? '';
  const day = draft.dayOfWeek ?? draft.dateKey ?? '';
  return `${place}|${day}|${draft.startMinutes}|${draft.endMinutes}`;
}

export interface CopyPlan {
  toCreate: ShiftDraft[];
  skipped: number;
}

/**
 * Calcula o que criar ao copiar uma semana. Pura (sem BD): `existing` são
 * os turnos que já lá estão no destino, para saltar duplicados.
 */
export function planWeekCopy(
  mode: CopyWeekMode,
  sources: ShiftSource[],
  existing: ShiftDraft[],
  context: CopyContext,
): CopyPlan {
  const seen = new Set(existing.map(shiftIdentity));
  const toCreate: ShiftDraft[] = [];
  let skipped = 0;

  for (const source of sources) {
    const draft = DRAFT_BUILDERS[mode](source, context);
    const identity = shiftIdentity(draft);
    if (seen.has(identity)) {
      skipped += 1;
      continue;
    }
    seen.add(identity);
    toCreate.push(draft);
  }

  return { toCreate, skipped };
}
