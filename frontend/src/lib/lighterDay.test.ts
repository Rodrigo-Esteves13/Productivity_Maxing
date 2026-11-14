import { describe, expect, it } from 'vitest';
import { suggestLighterDay } from './lighterDay';

describe('suggestLighterDay', () => {
  it('picks the emptiest day in the next week, earliest on ties', () => {
    const counts = new Map([
      ['2026-11-13', 3],
      ['2026-11-14', 2],
      ['2026-11-15', 0],
      ['2026-11-16', 0],
    ]);
    expect(suggestLighterDay('2026-11-13', counts)).toBe('2026-11-15');
  });
  it('returns null when nothing is lighter', () => {
    const counts = new Map([
      ['2026-11-13', 1],
      ['2026-11-14', 1],
    ]);
    const full = new Map(counts);
    for (let d = 15; d <= 20; d++) full.set(`2026-11-${d}`, 2);
    expect(suggestLighterDay('2026-11-13', full)).toBeNull();
  });
  it('crosses month ends', () => {
    expect(suggestLighterDay('2026-11-30', new Map([['2026-11-30', 2]]))).toBe('2026-12-01');
  });
});
