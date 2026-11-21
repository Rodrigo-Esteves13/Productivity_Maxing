import type { FlashcardForecast, FlashcardForecastDay, FlashcardForecastExam } from '../api/flashcardsService';

// Dia com mais cartoes que isto, perto de um exame, e sinal de aviso.
export const FLASHCARD_FORECAST_HEAVY_DAY = 40;
// Quantos dias antes do exame contam como "perto".
export const FLASHCARD_FORECAST_EXAM_WINDOW_DAYS = 3;
// Janela do resumo "a vencer nos proximos dias".
export const FLASHCARD_FORECAST_SUMMARY_DAYS = 7;
// Chave do backend para cartoes sem cadeira.
export const FLASHCARD_FORECAST_NO_AREA = 'none';

const MS_PER_DAY = 86_400_000;
const FULL_HEIGHT = 100;

export interface ForecastBar {
  date: string;
  count: number;
  // 0..100, relativo ao maior dia do filtro.
  heightPercent: number;
  examTitles: string[];
  // Dia pesado nos dias antes de um exame.
  heavyBeforeExam: boolean;
}

export interface BusiestDay {
  date: string;
  count: number;
}

const toUtcDay = (date: string): number => Date.parse(`${date}T00:00:00Z`);

export function dayCount(day: FlashcardForecastDay, areaId: string | null): number {
  return areaId === null ? day.total : (day.byArea[areaId] ?? 0);
}

export function examsForArea(exams: FlashcardForecastExam[], areaId: string | null): FlashcardForecastExam[] {
  return areaId === null ? exams : exams.filter((e) => e.areaId === areaId);
}

// Areas com cartoes a vencer na janela, para o seletor (mais cartoes primeiro).
export function areaIdsWithCards(days: FlashcardForecastDay[]): string[] {
  const totals = new Map<string, number>();
  for (const day of days) {
    for (const [id, n] of Object.entries(day.byArea)) totals.set(id, (totals.get(id) ?? 0) + n);
  }
  return [...totals.entries()].filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).map(([id]) => id);
}

// Dias com mais de `heavy` cartoes que ficam 1 a 3 dias antes de um exame.
export function heavyDaysBeforeExam(
  days: FlashcardForecastDay[],
  exams: FlashcardForecastExam[],
  areaId: string | null,
  heavy: number = FLASHCARD_FORECAST_HEAVY_DAY,
): Set<string> {
  const examDays = examsForArea(exams, areaId).map((e) => toUtcDay(e.date));
  const result = new Set<string>();
  for (const day of days) {
    if (dayCount(day, areaId) <= heavy) continue;
    const t = toUtcDay(day.date);
    const near = examDays.some((e) => {
      const diff = Math.round((e - t) / MS_PER_DAY);
      return diff >= 1 && diff <= FLASHCARD_FORECAST_EXAM_WINDOW_DAYS;
    });
    if (near) result.add(day.date);
  }
  return result;
}

export function buildBars(forecast: FlashcardForecast, areaId: string | null): ForecastBar[] {
  const counts = forecast.days.map((d) => dayCount(d, areaId));
  const max = Math.max(0, ...counts);
  const exams = examsForArea(forecast.exams, areaId);
  const heavy = heavyDaysBeforeExam(forecast.days, forecast.exams, areaId);
  return forecast.days.map((day, i) => ({
    date: day.date,
    count: counts[i],
    heightPercent: max === 0 ? 0 : (counts[i] / max) * FULL_HEIGHT,
    examTitles: exams.filter((e) => e.date === day.date).map((e) => e.title),
    heavyBeforeExam: heavy.has(day.date),
  }));
}

// Dia mais carregado (o primeiro em caso de empate); null se nao ha cartoes.
export function busiestDay(bars: ForecastBar[]): BusiestDay | null {
  let best: BusiestDay | null = null;
  for (const bar of bars) {
    if (bar.count > 0 && (best === null || bar.count > best.count)) best = { date: bar.date, count: bar.count };
  }
  return best;
}

export function totalInNextDays(bars: ForecastBar[], days: number = FLASHCARD_FORECAST_SUMMARY_DAYS): number {
  return bars.slice(0, days).reduce((sum, bar) => sum + bar.count, 0);
}
