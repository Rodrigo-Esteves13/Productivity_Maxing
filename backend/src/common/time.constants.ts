// Constantes de tempo partilhadas. Antes cada ficheiro redefinia a sua
// copia (86_400_000, 60 * 60 * 1000, 1440...).
export const MS_PER_SECOND = 1000;
export const MS_PER_MINUTE = 60 * MS_PER_SECOND;
export const MS_PER_HOUR = 60 * MS_PER_MINUTE;
export const MS_PER_DAY = 24 * MS_PER_HOUR;
export const MINUTES_PER_HOUR = 60;
export const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;
export const ISO_DATE_KEY_LENGTH = 'YYYY-MM-DD'.length;

// Fuso de referencia da app: o "dia" de uma aula/turno/task e o dia em Lisboa.
export const APP_TIME_ZONE = 'Europe/Lisbon';
