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
