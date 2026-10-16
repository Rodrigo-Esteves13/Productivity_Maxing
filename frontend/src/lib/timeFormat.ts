// Formatação de tempo partilhada pelo plano de estudo, horário e
// dashboard. Antes havia uma cópia de formatMinutes() em cada componente.

import { MINUTES_PER_DAY, MINUTES_PER_HOUR } from './timeConstants';

/** Minutos desde a meia-noite -> "HH:MM". */
export function formatClock(minutes: number): string {
  const h = Math.floor(minutes / MINUTES_PER_HOUR).toString().padStart(2, '0');
  const m = (minutes % MINUTES_PER_HOUR).toString().padStart(2, '0');
  return `${h}:${m}`;
}

/** Duração em minutos -> "2h 30m", "45m" ou "3h". */
export function formatDuration(totalMinutes: number): string {
  const rounded = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(rounded / MINUTES_PER_HOUR);
  const minutes = rounded % MINUTES_PER_HOUR;
  if (hours === 0) return `${minutes}m`;
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}

/** "HH:MM" (input type=time) -> minutos desde a meia-noite. */
export function parseClock(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const minutes = Number(match[1]) * MINUTES_PER_HOUR + Number(match[2]);
  return minutes >= 0 && minutes <= MINUTES_PER_DAY ? minutes : null;
}

/** "YYYY-MM-DD" -> "Mon, 5 Oct" (sempre em UTC, sem deslocar o dia). */
export function formatDayLabel(dateKey: string): string {
  return new Date(`${dateKey}T00:00:00Z`).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}
