import type { SubjectAttendance } from './attendance-summary.util';

// Espelho de frontend/src/lib/attendanceLimit.ts (mesmos valores e mesma
// semantica de "perto"/"acima"). Manter os dois em sincronia.
export const DEFAULT_ABSENCE_LIMIT_PCT = 25;
export const NEAR_LIMIT_RATIO = 0.8;
// Amostra minima: com poucas aulas dadas 1 falta ja e 100%. Abaixo deste
// numero de aulas dadas (presentes + faltas + por marcar) nao ha "perto"/"acima".
// So existe aqui (aviso push); o frontend (attendanceLimit.ts) ainda nao a aplica.
export const MIN_HELD_CLASSES = 4;
const FULL_PERCENT = 100;

export type AbsenceRisk = 'none' | 'near' | 'over';

// Faltas sobre as aulas ja dadas (presentes + faltas + por marcar).
export function absenceShare(row: SubjectAttendance): number | null {
  const held = row.attended + row.missed + row.unmarked;
  return held > 0 ? (row.missed / held) * FULL_PERCENT : null;
}

export function absenceRisk(
  row: SubjectAttendance,
  limitPct = DEFAULT_ABSENCE_LIMIT_PCT,
): AbsenceRisk {
  const held = row.attended + row.missed + row.unmarked;
  if (held < MIN_HELD_CLASSES) return 'none';
  const share = absenceShare(row);
  if (share === null || row.missed === 0) return 'none';
  if (share >= limitPct) return 'over';
  return share >= limitPct * NEAR_LIMIT_RATIO ? 'near' : 'none';
}
