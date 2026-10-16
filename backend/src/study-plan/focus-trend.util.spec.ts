import { buildFocusTrend, trendWindowStart } from './focus-trend.util';

const TODAY = new Date('2026-10-15T12:00:00Z'); // quinta; semana de 2026-10-12

describe('buildFocusTrend', () => {
  it('devolve sempre N semanas, a ultima e a atual', () => {
    const weeks = buildFocusTrend([], [], TODAY, 4);
    expect(weeks.map((w) => w.weekStart)).toEqual([
      '2026-09-21',
      '2026-09-28',
      '2026-10-05',
      '2026-10-12',
    ]);
    expect(
      weeks.every((w) => w.avgFocus === null && w.avgGradePercent === null),
    ).toBe(true);
  });

  it('pondera o foco pelos minutos e ignora sessoes sem foco', () => {
    const weeks = buildFocusTrend(
      [
        { startedAt: new Date('2026-10-13T10:00:00Z'), minutes: 60, focus: 2 },
        { startedAt: new Date('2026-10-14T10:00:00Z'), minutes: 180, focus: 4 },
        {
          startedAt: new Date('2026-10-14T18:00:00Z'),
          minutes: 120,
          focus: null,
        },
      ],
      [],
      TODAY,
      2,
    );
    const current = weeks[1];
    expect(current.avgFocus).toBe(3.5); // (60*2 + 180*4) / 240
    expect(current.ratedMinutes).toBe(240);
  });

  it('domingo conta para a semana que acaba nele', () => {
    const weeks = buildFocusTrend(
      [],
      [{ date: new Date('2026-10-11T20:00:00Z'), fraction: 0.8 }],
      TODAY,
      2,
    );
    expect(weeks[0].weekStart).toBe('2026-10-05');
    expect(weeks[0].avgGradePercent).toBe(80);
    expect(weeks[0].gradedTasks).toBe(1);
  });

  it('ignora dados fora da janela', () => {
    const weeks = buildFocusTrend(
      [{ startedAt: new Date('2026-01-05T10:00:00Z'), minutes: 60, focus: 5 }],
      [{ date: new Date('2026-01-05T10:00:00Z'), fraction: 1 }],
      TODAY,
      3,
    );
    expect(weeks.every((w) => w.avgFocus === null && w.gradedTasks === 0)).toBe(
      true,
    );
    expect(trendWindowStart(TODAY, 3).toISOString().slice(0, 10)).toBe(
      '2026-09-28',
    );
  });
});
