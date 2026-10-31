import {
  resolveRecurringDay,
  type ExceptionRule,
  type RecurringShift,
} from './schedule-exceptions.util';

const shift: RecurringShift = {
  id: 's1',
  commitmentId: 'c1',
  startMinutes: 9 * 60,
  endMinutes: 17 * 60,
  worksOnHolidays: false,
};

const rule = (overrides: Partial<ExceptionRule>): ExceptionRule => ({
  id: 'r1',
  kind: 'OFF',
  shiftId: null,
  commitmentId: null,
  startsOn: '2026-11-02',
  endsOn: '2026-11-08',
  startMinutes: null,
  endMinutes: null,
  ...overrides,
});

const none = new Set<string>();

describe('resolveRecurringDay', () => {
  it('sem excecoes nem feriado fica igual', () => {
    expect(resolveRecurringDay(shift, '2026-11-03', [], none)).toEqual({
      skipped: null,
      exceptionId: null,
      retimed: false,
      startMinutes: 540,
      endMinutes: 1020,
    });
  });

  it('ferias do local tiram o turno so dentro do intervalo', () => {
    const rules = [rule({ commitmentId: 'c1' })];
    expect(resolveRecurringDay(shift, '2026-11-08', rules, none).skipped).toBe(
      'OFF',
    );
    expect(
      resolveRecurringDay(shift, '2026-11-09', rules, none).skipped,
    ).toBeNull();
  });

  it('ferias de outro local nao mexem', () => {
    const rules = [rule({ commitmentId: 'other' })];
    expect(
      resolveRecurringDay(shift, '2026-11-03', rules, none).skipped,
    ).toBeNull();
  });

  it('nova hora numa semana muda so esse turno', () => {
    const rules = [
      rule({
        kind: 'RETIME',
        shiftId: 's1',
        startMinutes: 600,
        endMinutes: 1080,
      }),
    ];
    const day = resolveRecurringDay(shift, '2026-11-04', rules, none);
    expect(day).toMatchObject({
      retimed: true,
      startMinutes: 600,
      endMinutes: 1080,
      exceptionId: 'r1',
    });
    const other = resolveRecurringDay(
      { ...shift, id: 's2' },
      '2026-11-04',
      rules,
      none,
    );
    expect(other.retimed).toBe(false);
  });

  it('feriado tira o turno so quando o local nao trabalha em feriados', () => {
    const holidays = new Set(['2026-12-08']);
    expect(resolveRecurringDay(shift, '2026-12-08', [], holidays).skipped).toBe(
      'HOLIDAY',
    );
    expect(
      resolveRecurringDay(
        { ...shift, worksOnHolidays: true },
        '2026-12-08',
        [],
        holidays,
      ).skipped,
    ).toBeNull();
  });

  it('uma excecao explicita ganha ao feriado', () => {
    const holidays = new Set(['2026-12-08']);
    const rules = [
      rule({
        kind: 'RETIME',
        shiftId: 's1',
        startsOn: '2026-12-08',
        endsOn: '2026-12-08',
        startMinutes: 540,
        endMinutes: 1020,
      }),
    ];
    expect(
      resolveRecurringDay(shift, '2026-12-08', rules, holidays).skipped,
    ).toBeNull();
  });

  it('em sobreposicao vale a primeira da lista (a mais recente)', () => {
    const rules = [
      rule({
        id: 'newer',
        kind: 'RETIME',
        shiftId: 's1',
        startMinutes: 600,
        endMinutes: 700,
      }),
      rule({ id: 'older', kind: 'OFF', commitmentId: 'c1' }),
    ];
    expect(
      resolveRecurringDay(shift, '2026-11-03', rules, none).exceptionId,
    ).toBe('newer');
  });
});
