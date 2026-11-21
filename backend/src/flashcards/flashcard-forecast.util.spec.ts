import { bucketForecast } from './flashcard-forecast.util';
import {
  FLASHCARD_FORECAST_DAYS,
  FLASHCARD_FORECAST_NO_AREA,
} from './flashcards.constants';

// Inverno: Lisboa == UTC, evita ambiguidade de DST.
const NOW = new Date('2026-01-10T12:00:00.000Z');
const at = (iso: string, areaId: string | null = 'a1') => ({
  dueAt: new Date(iso),
  areaId,
});
const run = (cards: ReturnType<typeof at>[]) =>
  bucketForecast(cards, NOW, FLASHCARD_FORECAST_DAYS);

describe('bucketForecast', () => {
  it('returns empty days for no cards', () => {
    const days = run([]);
    expect(days).toHaveLength(FLASHCARD_FORECAST_DAYS);
    expect(days[0].date).toBe('2026-01-10');
    expect(days.every((d) => d.total === 0)).toBe(true);
  });

  it('folds overdue cards into day 0', () => {
    const days = run([
      at('2025-12-01T10:00:00.000Z'),
      at('2026-01-10T09:00:00.000Z'),
    ]);
    expect(days[0].total).toBe(2);
    expect(days[0].byArea).toEqual({ a1: 2 });
  });

  it('includes day 29 and excludes day 30', () => {
    const days = run([
      at('2026-02-08T10:00:00.000Z'),
      at('2026-02-09T10:00:00.000Z'),
    ]);
    expect(days[29].date).toBe('2026-02-08');
    expect(days[29].total).toBe(1);
    expect(days.reduce((s, d) => s + d.total, 0)).toBe(1);
  });

  it('groups cards without area under the none key', () => {
    const days = run([at('2026-01-11T10:00:00.000Z', null)]);
    expect(days[1].byArea).toEqual({ [FLASHCARD_FORECAST_NO_AREA]: 1 });
  });
});
