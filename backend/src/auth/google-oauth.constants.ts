// Endpoints fixos da Google OAuth2 usados por mais do que um ficheiro
// (google.strategy.ts, calendar.service.ts, auth.service.ts) - centralizados
// aqui em vez de cada um repetir a mesma base de URL literal, para nunca
// divergirem silenciosamente se um dia precisarem de mudar (ex: Google
// migrar para uma versão nova do endpoint).
export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
export const GOOGLE_TOKENINFO_URL = 'https://oauth2.googleapis.com/tokeninfo';

// Scope do Calendar: o mais estreito que a Google oferece para o nosso caso.
// So permite criar calendarios secundarios e gerir eventos DENTRO deles (nunca
// os eventos do calendario primario nem de outros calendarios do utilizador).
export const GOOGLE_CALENDAR_APP_SCOPE =
  'https://www.googleapis.com/auth/calendar.app.created';

// Base da Calendar API v3 (calendarios e eventos).
export const GOOGLE_CALENDAR_API_URL =
  'https://www.googleapis.com/calendar/v3';

// Nome do calendario secundario que a app cria na conta Google do utilizador.
export const GOOGLE_CALENDAR_NAME = 'Productivity Maxing';
