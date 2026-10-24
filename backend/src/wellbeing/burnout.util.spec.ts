import { detectBurnout, type BurnoutLog } from './burnout.util';

// Gera um check-in por dia no intervalo [from, to).
function days(
  from: number,
  to: number,
  values: Omit<BurnoutLog, 'daysAgo'>,
): BurnoutLog[] {
  return Array.from({ length: to - from }, (_, i) => ({
    daysAgo: from + i,
    ...values,
  }));
}

const good = { mood: 4, energy: 4, stress: 2 };
const bad = { mood: 2.5, energy: 2.5, stress: 4 };

describe('detectBurnout', () => {
  it('needs check-ins in both windows', () => {
    const result = detectBurnout(days(0, 2, bad), 600, 1800);
    expect(result).toEqual({
      kind: 'not_enough_data',
      recentLogs: 2,
      baselineLogs: 0,
    });
  });

  it('warns when mood drops while study load holds', () => {
    const logs = [
      ...days(0, 7, { mood: 2.5, energy: null, stress: null }),
      ...days(7, 28, { mood: 4, energy: null, stress: null }),
    ];
    const result = detectBurnout(logs, 7 * 120, 21 * 120);
    expect(result.kind).toBe('warning');
    if (result.kind !== 'warning') return;
    expect(result.signals).toEqual(['moodDrop', 'loadHeld']);
    expect(result.recentMood).toBe(2.5);
    expect(result.baselineMood).toBe(4);
    expect(result.recentStudyMinutesPerDay).toBe(120);
  });

  it('warns when energy drops and stress rises even with less study', () => {
    const logs = [...days(0, 7, bad), ...days(7, 28, good)];
    const result = detectBurnout(logs, 0, 21 * 120);
    expect(result.kind).toBe('warning');
    if (result.kind !== 'warning') return;
    expect(result.signals).toEqual(['moodDrop', 'energyDrop', 'stressRise']);
  });

  it('does not warn about a low week with no extra pressure', () => {
    const logs = [
      ...days(0, 7, { mood: 2.5, energy: null, stress: 2 }),
      ...days(7, 28, { mood: 4, energy: null, stress: 2 }),
    ];
    const result = detectBurnout(logs, 7 * 30, 21 * 120);
    expect(result).toEqual({ kind: 'ok', signals: ['moodDrop'] });
  });

  it('does not warn when mood is stable under a heavy load', () => {
    const logs = [...days(0, 7, good), ...days(7, 28, good)];
    const result = detectBurnout(logs, 7 * 300, 21 * 120);
    expect(result).toEqual({ kind: 'ok', signals: ['loadHeld'] });
  });
});
