// Limites do modulo de bem-estar (humor e medicacao). Protegem contra
// crescimento sem limite e definem as escalas aceites.

// Escala do humor, energia e stress (1 = muito mau/baixo, 5 = muito bom/alto).
export const RATING_MIN = 1;
export const RATING_MAX = 5;

export const MAX_MOOD_NOTE_LENGTH = 500;
// Janela maxima de GET /wellbeing/mood (um ano).
export const MAX_MOOD_RANGE_DAYS = 366;
// Dias analisados pelas correlacoes.
export const INSIGHTS_WINDOW_DAYS = 90;
// Abaixo disto uma correlacao e ruido: devolve "not_enough_data".
export const MIN_CORRELATION_SAMPLES = 7;

export const MAX_MEDICATIONS_PER_USER = 30;
export const MAX_MEDICATION_NAME_LENGTH = 100;
export const MAX_MEDICATION_DOSAGE_LENGTH = 60;
export const MAX_TIMES_PER_MEDICATION = 8;
export const MINUTES_PER_DAY = 1440;

// O cron dos lembretes corre de X em X minutos (ver RemindersController).
// Uma toma conta como "a horas de avisar" ate esta janela depois da hora
// marcada; mais tarde que isso ja nao faz sentido apitar.
export const MEDICATION_REMINDER_WINDOW_MINUTES = 60;
export const MEDICATION_PATH = '/wellbeing';
