// Endpoints fixos da Google OAuth2 usados por mais do que um ficheiro
// (google.strategy.ts, calendar.service.ts, auth.service.ts) - centralizados
// aqui em vez de cada um repetir a mesma base de URL literal, para nunca
// divergirem silenciosamente se um dia precisarem de mudar (ex: Google
// migrar para uma versão nova do endpoint).
export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
export const GOOGLE_TOKENINFO_URL = 'https://oauth2.googleapis.com/tokeninfo';
