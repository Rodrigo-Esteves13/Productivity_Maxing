import type { DateCertainty, Effort, Task } from '../types/models';
import { toDateKey, todayKey } from './dateKey';

// Valores fixos dos enums Effort/DateCertainty do schema.prisma, na ordem em
// que aparecem nos selects. Listas locais (em vez de virem de /tasks/meta
// pelas props do formulario) porque sao enums do schema, como Difficulty.
export const EFFORTS: readonly Effort[] = ['LIGHT', 'MODERATE', 'HEAVY', 'EXHAUSTIVE'];
export const DATE_CERTAINTIES: readonly DateCertainty[] = ['EXACT', 'APPROXIMATE', 'UNKNOWN', 'SURPRISE'];
export const DEFAULT_DATE_CERTAINTY: DateCertainty = 'EXACT';

// Esforco a partir do qual vale a pena avisar nos cartoes (LIGHT/MODERATE
// sao o normal e so fariam ruido).
const NOTABLE_EFFORTS: ReadonlySet<Effort> = new Set(['HEAVY', 'EXHAUSTIVE']);

// Mesma regra que FIRM_DATE_CERTAINTIES no backend (task-readiness.util.ts):
// so EXACT e APPROXIMATE sao prazos reais.
const FIRM_DATE_CERTAINTIES: ReadonlySet<DateCertainty> = new Set(['EXACT', 'APPROXIMATE']);

/** A data da task e um prazo real (pode ficar em atraso / ser "hoje"). */
export function hasFirmDate(task: Pick<Task, 'dateCertainty'>): boolean {
  // Resposta antiga (cache, backend por atualizar) sem o campo = EXACT.
  return FIRM_DATE_CERTAINTIES.has(task.dateCertainty ?? DEFAULT_DATE_CERTAINTY);
}

/** Ainda nao da para comecar: bloqueada a mao ou abre num dia futuro. */
export function isLocked(task: Pick<Task, 'isBlocked' | 'availableFrom'>, now: Date = new Date()): boolean {
  if (task.isBlocked) return true;
  return !!task.availableFrom && toDateKey(new Date(task.availableFrom)) > todayKey(now);
}

export function isNotableEffort(effort: Effort | null | undefined): effort is Effort {
  return !!effort && NOTABLE_EFFORTS.has(effort);
}
