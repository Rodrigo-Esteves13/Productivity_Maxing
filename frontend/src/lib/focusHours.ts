import type { DistractionHourBucket } from '../api/studySessionsService';
import { toLisbonWeekdayHour } from './studyWindow';

// Minimo de horas do dia com amostra fiavel (lowSample false) para comparar.
export const FOCUS_HOURS_MIN_BUCKETS = 3;
// A pior hora tem de ter pelo menos X vezes as distracoes/hora da melhor; abaixo
// disto a diferenca e ruido e nao se recomenda nada.
export const FOCUS_HOURS_MIN_GAP_RATIO = 2;
export const FOCUS_HOURS_RATE_DECIMALS = 1;

export interface FocusHours {
  bestHour: number;
  bestRate: number;
  worstHour: number;
  worstRate: number;
  // A hora de Lisboa de `now` e a melhor / a pior do utilizador.
  nowIsBest: boolean;
  nowIsWorst: boolean;
}

// Menos distracoes/hora primeiro; empate: mais minutos de foco (mais amostra).
function compareCalm(a: DistractionHourBucket, b: DistractionHourBucket): number {
  return a.distractionsPerHour - b.distractionsPerHour || b.totalMinutes - a.totalMinutes;
}

/**
 * Melhor e pior hora de foco (hora de Lisboa) a partir dos baldes por hora.
 * Devolve null sem recomendacao: poucos baldes fiaveis ou sem diferenca clara.
 */
export function computeFocusHours(buckets: DistractionHourBucket[], now: Date): FocusHours | null {
  const reliable = buckets.filter((b) => !b.lowSample);
  if (reliable.length < FOCUS_HOURS_MIN_BUCKETS) return null;

  const sorted = [...reliable].sort(compareCalm);
  const best = sorted[0];
  // Pior = mais distracoes/hora; empate: mais minutos de foco.
  const worst = [...reliable].sort((a, b) => b.distractionsPerHour - a.distractionsPerHour || b.totalMinutes - a.totalMinutes)[0];
  if (worst.distractionsPerHour <= best.distractionsPerHour) return null;
  if (worst.distractionsPerHour < best.distractionsPerHour * FOCUS_HOURS_MIN_GAP_RATIO) return null;

  const { hour } = toLisbonWeekdayHour(now);
  return {
    bestHour: best.hour,
    bestRate: best.distractionsPerHour,
    worstHour: worst.hour,
    worstRate: worst.distractionsPerHour,
    nowIsBest: hour === best.hour,
    nowIsWorst: hour === worst.hour,
  };
}

// "20:00" ou "8:00 PM" conforme a lingua. A hora ja e de Lisboa, so a
// formatamos (UTC fixo para o fuso do browser nao a deslocar).
export function formatFocusHour(hour: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }).format(
    new Date(Date.UTC(2024, 0, 1, hour)),
  );
}
