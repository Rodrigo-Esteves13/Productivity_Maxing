// URL do frontend, usada por CORS (main.ts), redirects de OAuth
// (auth.controller.ts, auth.service.ts, oauth-conflict-redirect.filter.ts)
// e pelos links nos emails (mail.service.ts). Centralizado aqui em vez de
// cada ficheiro repetir o mesmo fallback 'http://localhost:5173' - só
// serve para desenvolvimento local sem FRONTEND_URL definida; em produção
// (Render) a env var está sempre definida, este valor nunca é usado a
// sério lá.
const DEFAULT_LOCAL_FRONTEND_URL = 'http://localhost:5173';

export function getFrontendUrl(): string {
  return process.env.FRONTEND_URL ?? DEFAULT_LOCAL_FRONTEND_URL;
}

// Chave da Google Maps Distance Matrix API, usada só por
// ScheduleService.estimateCommute() para calcular commuteMinutes
// automaticamente a partir de homeAddress/campusAddress. Ao contrário dos
// segredos "obrigatórios" (JWT secret, etc.) esta NUNCA faz a app
// arrancar a falhar se estiver em falta - é uma feature opcional que cai
// sempre para o valor manual de commuteMinutes quando não está
// configurada (ver comentário em ScheduleService).
export function getGoogleMapsApiKey(): string | null {
  return process.env.GOOGLE_MAPS_API_KEY?.trim() || null;
}
