import type { CookieOptions } from 'express';

// Nomes e opções dos cookies de autenticação.
// Centralizado aqui para o controller, a JwtStrategy e o CsrfGuard usarem
// sempre exatamente o mesmo nome/opções (evita bugs de "esqueci-me de mudar
// num sítio").

export const ACCESS_TOKEN_COOKIE = 'access_token';
export const CSRF_COOKIE = 'csrf_token';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// Em produção o frontend (Netlify) e o backend (Render/Railway) vivem em
// domínios diferentes, por isso o cookie tem de ser SameSite=None (+Secure,
// que é obrigatório sempre que SameSite=None). Em desenvolvimento local
// (http://localhost) usamos Lax + Secure=false, porque o browser rejeita
// SameSite=None sem HTTPS.
const isProd = process.env.NODE_ENV === 'production';

export function accessTokenCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    path: '/',
    maxAge: SEVEN_DAYS_MS,
  };
}

// O cookie do CSRF NÃO pode ser httpOnly - o frontend precisa de o ler com
// JS para o poder reenviar no header X-CSRF-Token (padrão "double submit
// cookie").
export function csrfCookieOptions(): CookieOptions {
  return {
    httpOnly: false,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    path: '/',
    maxAge: SEVEN_DAYS_MS,
  };
}

// Usado no logout para limpar os dois cookies. As opções (exceto maxAge)
// têm de corresponder às usadas ao criar o cookie, senão o browser não o
// apaga.
export function clearCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    path: '/',
  };
}
