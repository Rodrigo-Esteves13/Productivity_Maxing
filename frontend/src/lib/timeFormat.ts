// Formatação de tempo partilhada pelo plano de estudo, horário e
// dashboard. Antes havia uma cópia de formatMinutes() em cada componente.

import { MINUTES_PER_DAY, MINUTES_PER_HOUR } from './timeConstants';
import { detectLanguage } from '../i18n/storage';
import { isUtcMidnight } from './dateKey';

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

/** "YYYY-MM-DD" -> "Mon, 5 Oct" (sempre em UTC, sem deslocar o dia), na lingua da app. */
export function formatDayLabel(dateKey: string): string {
  return new Date(`${dateKey}T00:00:00Z`).toLocaleDateString(detectLanguage(), {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

// Nome curto do dia na lingua da app (Intl), em vez de "Mon".."Sun" fixos.
// 7 jan 2024 foi domingo, por isso 7 + dayOfWeek (0=Dom) da o dia certo.
export function weekdayLabel(dayOfWeek: number, locale: string = detectLanguage()): string {
  return new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(new Date(2024, 0, 7 + dayOfWeek));
}

/** Nome curto do mes na lingua da app ("Sep", "9月", "set."). */
export function monthLabel(date: Date, locale: string = detectLanguage()): string {
  return new Intl.DateTimeFormat(locale, { month: 'short' }).format(date);
}

/**
 * Data de uma task na lingua da app. Uma task sem hora (meia-noite UTC) e
 * mostrada em UTC: com o fuso local, a oeste de Greenwich (ex: Brasil) o
 * prazo aparecia um dia antes. Uma task com hora usa o fuso local.
 */
export function formatTaskDate(value: string, locale: string = detectLanguage()): string {
  const date = new Date(value);
  return date.toLocaleDateString(locale, isUtcMidnight(date) ? { timeZone: 'UTC' } : undefined);
}

/** Data e hora curtas, na lingua da app (ex: avisos e notas da turma). */
export function formatDateTime(value: string, locale: string = detectLanguage()): string {
  return new Date(value).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });
}
