import type { AgendaItem } from './agenda';
import type { StudyPlanSuggestion } from '../types/models';
import { MINUTES_PER_HOUR } from './timeConstants';

// Escolhas do cartao "Hoje" do Dashboard, separadas do componente para se
// poderem testar sem relogio nem pedidos.

/** Minutos desde a meia-noite no relogio de quem esta a ver. */
export function minutesSinceMidnight(date: Date): number {
  return date.getHours() * MINUTES_PER_HOUR + date.getMinutes();
}

/** Aula ou turno a decorrer agora, senao o proximo de hoje. null = ja nao ha mais. */
export function currentOrNextAgendaItem(items: AgendaItem[], nowMinutes: number): AgendaItem | null {
  return items.find((item) => item.endMinutes > nowMinutes) ?? null;
}

/** Bloco de estudo de hoje a decorrer ou o proximo (sugestoes do plano de estudo). */
export function nextStudyBlock(
  suggestions: StudyPlanSuggestion[],
  todayKey: string,
  nowMinutes: number,
): StudyPlanSuggestion | null {
  return (
    suggestions
      .filter((block) => block.date.slice(0, 10) === todayKey && block.endMinutes > nowMinutes)
      .sort((a, b) => a.startMinutes - b.startMinutes)[0] ?? null
  );
}
