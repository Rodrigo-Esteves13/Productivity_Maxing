// Como um turno semanal fica num dia concreto depois das excecoes
// (ScheduleException) e dos feriados. Puro, usado pelo expandRange e pelos
// testes.

export interface ExceptionRule {
  id: string;
  kind: 'OFF' | 'RETIME';
  shiftId: string | null;
  commitmentId: string | null;
  /** YYYY-MM-DD, inclusive. */
  startsOn: string;
  endsOn: string;
  startMinutes: number | null;
  endMinutes: number | null;
}

export interface RecurringShift {
  id: string;
  commitmentId: string | null;
  startMinutes: number;
  endMinutes: number;
  /** Do local; turnos soltos (sem local) mantem sempre o horario. */
  worksOnHolidays: boolean;
}

export type SkipReason = 'OFF' | 'HOLIDAY';

export interface DayResolution {
  skipped: SkipReason | null;
  /** Excecao que decidiu este dia (para a desfazer na grelha). */
  exceptionId: string | null;
  retimed: boolean;
  startMinutes: number;
  endMinutes: number;
}

/** Uma excecao apanha o turno: o proprio, todo o local, ou tudo. */
function targets(rule: ExceptionRule, shift: RecurringShift): boolean {
  if (rule.shiftId !== null) return rule.shiftId === shift.id;
  if (rule.commitmentId !== null)
    return rule.commitmentId === shift.commitmentId;
  return true;
}

/**
 * `rules` vem da mais recente para a mais antiga: em sobreposicao ganha a
 * ultima que a pessoa criou. Uma excecao explicita ganha ao feriado (dizer
 * "nesse dia entro as 10h" e escolher trabalhar no feriado).
 */
export function resolveRecurringDay(
  shift: RecurringShift,
  dayKey: string,
  rules: readonly ExceptionRule[],
  holidays: ReadonlySet<string>,
): DayResolution {
  const rule = rules.find(
    (r) => r.startsOn <= dayKey && r.endsOn >= dayKey && targets(r, shift),
  );
  if (rule?.kind === 'OFF') {
    return { ...normal(shift), skipped: 'OFF', exceptionId: rule.id };
  }
  if (
    rule?.kind === 'RETIME' &&
    rule.startMinutes !== null &&
    rule.endMinutes !== null
  ) {
    return {
      skipped: null,
      exceptionId: rule.id,
      retimed: true,
      startMinutes: rule.startMinutes,
      endMinutes: rule.endMinutes,
    };
  }
  if (!shift.worksOnHolidays && holidays.has(dayKey)) {
    return { ...normal(shift), skipped: 'HOLIDAY' };
  }
  return normal(shift);
}

function normal(shift: RecurringShift): DayResolution {
  return {
    skipped: null,
    exceptionId: null,
    retimed: false,
    startMinutes: shift.startMinutes,
    endMinutes: shift.endMinutes,
  };
}
