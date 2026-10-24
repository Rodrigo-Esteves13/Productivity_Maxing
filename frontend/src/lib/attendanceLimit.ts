import { FULL_PERCENT } from './percent';
import type { SubjectAttendance } from '../types/models';

// Limite de faltas por omissao (muitas faculdades: no maximo 25% das aulas).
export const DEFAULT_ABSENCE_LIMIT_PCT = 25;
export const MIN_ABSENCE_LIMIT_PCT = 1;
export const MAX_ABSENCE_LIMIT_PCT = 100;
// A partir desta fracao do limite a disciplina aparece como "perto".
export const NEAR_LIMIT_RATIO = 0.8;

export type AbsenceRisk = 'none' | 'near' | 'over';

// Faltas sobre as aulas ja dadas (presentes + faltas + por marcar): as por
// marcar contam como aulas dadas, nao como faltas.
export function absenceShare(row: SubjectAttendance): number | null {
  const held = row.attended + row.missed + row.unmarked;
  return held > 0 ? (row.missed / held) * FULL_PERCENT : null;
}

export function absenceRisk(row: SubjectAttendance, limitPct: number): AbsenceRisk {
  const share = absenceShare(row);
  if (share === null || row.missed === 0) return 'none';
  if (share >= limitPct) return 'over';
  return share >= limitPct * NEAR_LIMIT_RATIO ? 'near' : 'none';
}

export function clampAbsenceLimit(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_ABSENCE_LIMIT_PCT;
  return Math.min(MAX_ABSENCE_LIMIT_PCT, Math.max(MIN_ABSENCE_LIMIT_PCT, Math.round(value)));
}
