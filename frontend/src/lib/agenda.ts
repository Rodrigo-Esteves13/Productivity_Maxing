import type { ClassOccurrence, WorkShiftOccurrence } from '../types/models';

export type AgendaItem =
  | { kind: 'class'; id: string; startMinutes: number; endMinutes: number; occurrence: ClassOccurrence }
  | { kind: 'shift'; id: string; startMinutes: number; endMinutes: number; occurrence: WorkShiftOccurrence };

/**
 * Junta aulas e turnos de UM dia numa so lista por ordem de hora. Antes
 * a grelha mostrava primeiro todas as aulas e depois todos os turnos, por
 * isso um turno as 08:00 aparecia depois de uma aula as 14:00.
 */
export function mergeAgenda(classes: ClassOccurrence[], shifts: WorkShiftOccurrence[]): AgendaItem[] {
  const items: AgendaItem[] = [
    ...classes.map((occurrence): AgendaItem => ({
      kind: 'class',
      id: occurrence.id,
      startMinutes: occurrence.startMinutes,
      endMinutes: occurrence.endMinutes,
      occurrence,
    })),
    ...shifts.map((occurrence): AgendaItem => ({
      kind: 'shift',
      id: `${occurrence.shiftId}-${occurrence.date}`,
      startMinutes: occurrence.startMinutes,
      endMinutes: occurrence.endMinutes,
      occurrence,
    })),
  ];
  return items.sort((a, b) => a.startMinutes - b.startMinutes || a.endMinutes - b.endMinutes);
}
