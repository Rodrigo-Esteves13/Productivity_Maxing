import { describe, expect, it } from 'vitest';
import { computeStreak, streakAtRisk, toLocalDayKey } from './profileStats';

// 2026-11-02 e segunda-feira. Datas locais (mes 0-based).
const at = (m: number, d: number) => new Date(2026, m - 1, d, 12, 0, 0);
const keys = (...days: Array<[number, number]>) => new Set(days.map(([m, d]) => toLocalDayKey(at(m, d))));

describe('computeStreak', () => {
  it('none: counts consecutive days, unchanged', () => {
    const done = keys([10, 29], [10, 30], [10, 31], [11, 1]);
    expect(computeStreak(done, 'none', at(11, 1)).streak).toBe(4);
  });

  it('none: today not done does not break', () => {
    const done = keys([10, 30], [10, 31]);
    expect(computeStreak(done, 'none', at(11, 1)).streak).toBe(2);
  });

  it('none: missed yesterday breaks', () => {
    const done = keys([10, 29], [10, 30]);
    expect(computeStreak(done, 'none', at(11, 1)).streak).toBe(0);
  });

  it('weekends: Sat and Sun gap does not break nor count', () => {
    // Sex 30/10 feito, Sab 31 e Dom 1 sem nada, Seg 2/11 feito.
    const done = keys([10, 29], [10, 30], [11, 2]);
    const r = computeStreak(done, 'weekends', at(11, 2));
    expect(r.streak).toBe(3);
    expect(r.restDaysUsed).toBe(2);
    expect(computeStreak(done, 'none', at(11, 2)).streak).toBe(1);
  });

  it('weekends: weekday miss still breaks', () => {
    const done = keys([10, 28], [10, 30], [11, 2]);
    expect(computeStreak(done, 'weekends', at(11, 2)).streak).toBe(2);
  });

  it('weeklyFreeze: one miss per week is forgiven', () => {
    // Semana 26/10-1/11: Seg feito, Ter perdido, Qua e Qui feitos.
    const done = keys([10, 26], [10, 28], [10, 29]);
    const r = computeStreak(done, 'weeklyFreeze', at(10, 29));
    expect(r.streak).toBe(3);
    expect(r.restDaysUsed).toBe(1);
  });

  it('weeklyFreeze: second miss in same week breaks', () => {
    // Seg feito, Ter perdido (perdoado), Qua perdido (quebra), Qui feito.
    const done = keys([10, 26], [10, 29]);
    expect(computeStreak(done, 'weeklyFreeze', at(10, 29)).streak).toBe(1);
  });

  it('weeklyFreeze: freeze renews on next calendar week', () => {
    // Misses Qua 21/10 e Qua 28/10 (semanas diferentes), tudo o resto feito.
    const days: Array<[number, number]> = [
      [10, 19], [10, 20], [10, 22], [10, 23], [10, 24], [10, 25], [10, 26], [10, 27], [10, 29],
    ];
    expect(computeStreak(keys(...days), 'weeklyFreeze', at(10, 29)).streak).toBe(9);
  });

  it('weeklyFreeze: miss crossing Sunday to Monday uses two freezes', () => {
    // Dom 25 perdido (semana A) e Seg 26 perdido (semana B): ambos perdoados.
    const done = keys([10, 24], [10, 27]);
    expect(computeStreak(done, 'weeklyFreeze', at(10, 27)).streak).toBe(2);
  });
});

describe('streakAtRisk', () => {
  it('true when streak > 0 and today not done (none)', () => {
    expect(streakAtRisk(keys([10, 30], [10, 31]), 'none', at(11, 1))).toBe(true);
  });

  it('false when today done', () => {
    expect(streakAtRisk(keys([10, 31], [11, 1]), 'none', at(11, 1))).toBe(false);
  });

  it('false when streak is 0', () => {
    expect(streakAtRisk(new Set(), 'none', at(11, 1))).toBe(false);
  });

  it('false on a weekend rest day', () => {
    // Sex feito, hoje Sab 31/10.
    expect(streakAtRisk(keys([10, 30]), 'weekends', at(10, 31))).toBe(false);
    expect(streakAtRisk(keys([10, 30]), 'none', at(10, 31))).toBe(true);
  });

  it('weeklyFreeze: safe while freeze unused, at risk after it is spent', () => {
    // Seg e Ter feitos, hoje Qua por fazer: ainda ha congelamento.
    expect(streakAtRisk(keys([10, 26], [10, 27]), 'weeklyFreeze', at(10, 28))).toBe(false);
    // Seg feito, Ter perdido (gasta o congelamento), hoje Qua por fazer.
    expect(streakAtRisk(keys([10, 26]), 'weeklyFreeze', at(10, 28))).toBe(true);
  });
});
