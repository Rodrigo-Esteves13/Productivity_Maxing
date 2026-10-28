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

// Alerta de burnout (ver burnout.util.ts): ultima semana vs as 3 antes.
// Cabe dentro de INSIGHTS_WINDOW_DAYS, por isso reusa a mesma query.
export const BURNOUT_RECENT_DAYS = 7;
export const BURNOUT_BASELINE_DAYS = 21;
export const BURNOUT_MIN_RECENT_LOGS = 3;
export const BURNOUT_MIN_BASELINE_LOGS = 5;
// Queda (ou subida, no stress) minima na escala 1-5 para contar.
export const BURNOUT_DROP_THRESHOLD = 0.75;
// Estudo por dia recente >= 90% do de base = "a carga nao baixou".
export const BURNOUT_LOAD_HELD_RATIO = 0.9;

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

// Medicacao "se necessario": registo por toma.
export const MAX_INTAKES_PER_DAY = 30;
export const MAX_INTAKE_NOTE_LENGTH = 200;
// Nao deixa registar tomas muito antigas nem no futuro.
export const MAX_INTAKE_PAST_DAYS = 30;
export const MAX_INTAKE_FUTURE_MINUTES = 5;
// Janela maxima de GET /wellbeing/medications/intakes.
export const MAX_INTAKE_RANGE_DAYS = 62;

// Versao do aviso legal da medicacao. Mudar o texto do aviso (frontend,
// wellbeing.meds.disclaimer.*) obriga a subir este numero: todos voltam a
// ter de o aceitar antes de adicionar medicamentos ou registar tomas.
// v2: finalidade, uso pessoal, maior de idade, janela de 24 horas.
// v3: ninguem vigia os registos; numeros de emergencia e apoio.
// v4: a app deixou de dar avisos de combinacoes, limites ou dependencia.
export const MEDICATION_DISCLAIMER_VERSION = 4;
export const LOCALE_PATTERN = /^[a-z]{2}(-[A-Z]{2})?$/;

// Historico de adesao (GET /wellbeing/medications/history): semana a 3 meses.
export const MAX_MEDICATION_HISTORY_DAYS = 92;

// Dadivas de sangue: so registo do proprio, a app nao decide se pode doar.
export const MAX_BLOOD_DONATIONS_PER_USER = 300;
export const MAX_BLOOD_DONATION_LOCATION_LENGTH = 120;
export const MAX_BLOOD_DONATION_NOTE_LENGTH = 300;
