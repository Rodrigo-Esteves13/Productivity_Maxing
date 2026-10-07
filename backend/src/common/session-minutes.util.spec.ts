import {
  focusWeight,
  resolveFocusedStudyMinutes,
  resolveStudyMinutes,
  sumFocusedSessionMinutes,
  sumSessionMinutes,
} from './session-minutes.util';

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

describe('focusWeight', () => {
  it('sem nota (null/undefined) pesa por inteiro', () => {
    expect(focusWeight(null)).toBe(1);
    expect(focusWeight(undefined)).toBe(1);
  });

  it('notas baixas descontam, 4 e 5 contam por inteiro', () => {
    expect(focusWeight(1)).toBe(0.5);
    expect(focusWeight(2)).toBe(0.7);
    expect(focusWeight(3)).toBe(0.85);
    expect(focusWeight(4)).toBe(1);
    expect(focusWeight(5)).toBe(1);
  });

  it('nota fora do intervalo não rebenta nem inventa peso', () => {
    expect(focusWeight(0)).toBe(1);
    expect(focusWeight(9)).toBe(1);
  });
});

describe('sumFocusedSessionMinutes / resolveFocusedStudyMinutes', () => {
  const rated = (
    start: string,
    end: string | null,
    focusRating: number | null,
  ) => ({
    startedAt: at(start),
    endedAt: end ? at(end) : null,
    focusRating,
  });

  it('uma hora com concentração 1 conta 30 minutos', () => {
    expect(
      sumFocusedSessionMinutes([
        rated('2026-10-01T10:00:00Z', '2026-10-01T11:00:00Z', 1),
      ]),
    ).toBe(30);
  });

  it('mistura sessões com e sem nota', () => {
    expect(
      sumFocusedSessionMinutes([
        rated('2026-10-01T10:00:00Z', '2026-10-01T11:00:00Z', 5), // 60
        rated('2026-10-01T12:00:00Z', '2026-10-01T13:00:00Z', null), // 60
        rated('2026-10-01T14:00:00Z', '2026-10-01T15:00:00Z', 2), // 42
      ]),
    ).toBe(162);
  });

  it('sessão aberta não conta', () => {
    expect(
      sumFocusedSessionMinutes([rated('2026-10-01T10:00:00Z', null, 5)]),
    ).toBe(0);
  });

  it('sessões reais ganham ao tempo recordado, mesmo ponderadas', () => {
    expect(
      resolveFocusedStudyMinutes(
        [rated('2026-10-01T10:00:00Z', '2026-10-01T11:00:00Z', 1)],
        600,
      ),
    ).toBe(30);
  });

  it('sem sessões usa o tempo recordado sem ponderar', () => {
    expect(resolveFocusedStudyMinutes([], 480)).toBe(480);
    expect(resolveFocusedStudyMinutes([], null)).toBe(0);
  });

  it('sem nota em nenhuma sessão dá o mesmo que o tempo de relógio', () => {
    const sessions = [
      rated('2026-10-01T10:00:00Z', '2026-10-01T11:30:00Z', null),
    ];
    expect(sumFocusedSessionMinutes(sessions)).toBe(
      sumSessionMinutes(sessions),
    );
  });
});
