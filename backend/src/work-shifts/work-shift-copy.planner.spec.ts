import { parseDateKey } from '../common/date-key.util';
import {
  planWeekCopy,
  shiftIdentity,
  ShiftDraft,
  ShiftSource,
} from './work-shift-copy.planner';

const FROM = parseDateKey('2026-09-28'); // segunda
const TO = parseDateKey('2026-10-05'); // segunda seguinte
const CONTEXT = { fromWeekStart: FROM, toWeekStart: TO };

function source(dateKey: string, overrides: Partial<ShiftSource> = {}) {
  return {
    commitmentId: 'job',
    label: null,
    bufferMinutes: 20,
    date: parseDateKey(dateKey),
    startMinutes: 540,
    endMinutes: 1020,
    ...overrides,
  } satisfies ShiftSource;
}

describe('planWeekCopy', () => {
  it('one-off: desloca cada turno exatamente 7 dias', () => {
    const plan = planWeekCopy(
      'one-off',
      [source('2026-09-28'), source('2026-10-02')],
      [],
      CONTEXT,
    );
    expect(plan.toCreate.map((d) => d.dateKey)).toEqual([
      '2026-10-05',
      '2026-10-09',
    ]);
    expect(plan.toCreate.every((d) => d.dayOfWeek === null)).toBe(true);
  });

  it('fixed: usa o dia da semana e não guarda data', () => {
    const plan = planWeekCopy('fixed', [source('2026-10-02')], [], CONTEXT);
    expect(plan.toCreate[0]).toMatchObject({ dayOfWeek: 5, dateKey: null });
  });

  it('salta duplicados já existentes no destino', () => {
    const existing: ShiftDraft[] = [
      {
        commitmentId: 'job',
        label: null,
        bufferMinutes: 20,
        dayOfWeek: null,
        dateKey: '2026-10-05',
        startMinutes: 540,
        endMinutes: 1020,
      },
    ];
    const plan = planWeekCopy(
      'one-off',
      [source('2026-09-28'), source('2026-09-29')],
      existing,
      CONTEXT,
    );
    expect(plan.skipped).toBe(1);
    expect(plan.toCreate).toHaveLength(1);
    expect(plan.toCreate[0].dateKey).toBe('2026-10-06');
  });

  it('fixed: dois turnos pontuais iguais em semanas diferentes não duplicam', () => {
    // Mesma segunda-feira, mesmo local e horas, repetido na origem.
    const plan = planWeekCopy(
      'fixed',
      [source('2026-09-28'), source('2026-09-28')],
      [],
      CONTEXT,
    );
    expect(plan.toCreate).toHaveLength(1);
    expect(plan.skipped).toBe(1);
  });

  it('copiar duas vezes é idempotente', () => {
    const first = planWeekCopy('one-off', [source('2026-09-28')], [], CONTEXT);
    const second = planWeekCopy(
      'one-off',
      [source('2026-09-28')],
      first.toCreate,
      CONTEXT,
    );
    expect(second.toCreate).toHaveLength(0);
    expect(second.skipped).toBe(1);
  });

  it('identidade distingue horas diferentes', () => {
    const a = planWeekCopy('fixed', [source('2026-09-28')], [], CONTEXT)
      .toCreate[0];
    const b = { ...a, endMinutes: a.endMinutes + 60 };
    expect(shiftIdentity(a)).not.toBe(shiftIdentity(b));
  });
});
