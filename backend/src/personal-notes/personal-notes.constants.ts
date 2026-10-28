import { MS_PER_DAY } from '../common/time.constants';

export const PERSONAL_NOTE_TITLE_MAX_LENGTH = 200;
export const PERSONAL_NOTE_BODY_MAX_LENGTH = 10_000;
export const MAX_PERSONAL_NOTES_PER_USER = 500;
// Um lembrete atrasado (o cron pode falhar umas horas) ainda serve ate um
// dia depois; mais tarde que isso so aparece na pagina, sem push.
export const PERSONAL_REMINDER_LATE_WINDOW_MS = MS_PER_DAY;
export const MAX_PERSONAL_REMINDERS_PER_RUN = 500;
// Nao deixa marcar lembretes para daqui a mais de dois anos.
export const MAX_REMINDER_AHEAD_MS = 2 * 365 * MS_PER_DAY;
export const PERSONAL_NOTES_PATH = '/notes';
export const PERSONAL_NOTE_WRITES_PER_MINUTE = 60;
