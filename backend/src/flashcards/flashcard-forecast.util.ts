import {
  addUtcDays,
  parseDateKey,
  toDateKey,
  toLisbonDateKey,
} from '../common/date-key.util';
import { FLASHCARD_FORECAST_NO_AREA } from './flashcards.constants';

export interface ForecastCard {
  dueAt: Date;
  areaId: string | null;
}

export interface ForecastDay {
  date: string;
  total: number;
  byArea: Record<string, number>;
}

// Chaves "YYYY-MM-DD" consecutivas, a primeira e o dia de Lisboa de `now`.
export function forecastDayKeys(now: Date, days: number): string[] {
  const first = parseDateKey(toLisbonDateKey(now));
  return Array.from({ length: days }, (_, i) =>
    toDateKey(addUtcDays(first, i)),
  );
}

// Reparte cartoes por dia (Lisboa). Atrasados entram no dia 0; alem do
// ultimo dia sao ignorados.
export function bucketForecast(
  cards: ForecastCard[],
  now: Date,
  days: number,
): ForecastDay[] {
  const keys = forecastDayKeys(now, days);
  const result: ForecastDay[] = keys.map((date) => ({
    date,
    total: 0,
    byArea: {},
  }));
  const indexByKey = new Map(keys.map((k, i) => [k, i]));
  const lastKey = keys[keys.length - 1];

  for (const card of cards) {
    const key = toLisbonDateKey(card.dueAt);
    let idx: number | undefined;
    if (key < keys[0]) idx = 0;
    else if (key <= lastKey) idx = indexByKey.get(key);
    if (idx === undefined) continue;
    const area = card.areaId ?? FLASHCARD_FORECAST_NO_AREA;
    const day = result[idx];
    day.total += 1;
    day.byArea[area] = (day.byArea[area] ?? 0) + 1;
  }
  return result;
}
