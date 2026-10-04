import { resolveStudyMinutes, sumSessionMinutes } from './session-minutes.util';

const at = (iso: string) => new Date(iso);
const session = (start: string, end: string | null) => ({
  startedAt: at(start),
  endedAt: end ? at(end) : null,
});

describe('resolveStudyMinutes', () => {
  const oneHour = [session('2026-10-01T10:00:00Z', '2026-10-01T11:00:00Z')];

  it('sessões reais ganham sempre ao tempo recordado', () => {
    expect(resolveStudyMinutes(oneHour, 600)).toBe(60);
  });

  it('sem sessões usa o tempo recordado', () => {
    expect(resolveStudyMinutes([], 480)).toBe(480);
  });

  it('sessão ainda aberta não conta e cai no recordado', () => {
    expect(
      resolveStudyMinutes([session('2026-10-01T10:00:00Z', null)], 90),
    ).toBe(90);
  });

  it('sem nada devolve 0 (null, undefined e 0 não contam)', () => {
    expect(resolveStudyMinutes([], null)).toBe(0);
    expect(resolveStudyMinutes([], undefined)).toBe(0);
    expect(resolveStudyMinutes([], 0)).toBe(0);
  });

  it('sumSessionMinutes continua a somar só sessões terminadas', () => {
    expect(
      sumSessionMinutes([
        ...oneHour,
        session('2026-10-02T10:00:00Z', '2026-10-02T10:30:00Z'),
        session('2026-10-03T10:00:00Z', null),
      ]),
    ).toBe(90);
  });
});
