import type { CookieOptions } from 'express';

export const ACCESS_TOKEN_COOKIE = 'access_token';
export const CSRF_COOKIE = 'csrf_token';
export const OAUTH_LOGIN_STATE_COOKIE = 'oauth_login_state';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const FIVE_MINUTES_MS = 5 * 60 * 1000;

const isProd = process.env.NODE_ENV === 'production';

// Permite testar a imagem "production" localmente sem HTTPS (docker compose
// prod local) sem mexer no NODE_ENV - que continua a controlar tudo o resto
// (swagger desligado, logging, etc). Sem esta env var definida explicitamente,
// mantém-se sempre === isProd, por isso o Render nunca fica menos seguro por
// omissão - só um COOKIE_SECURE=false explícito no compose local destranca isto.
const cookieSecureOverride = process.env.COOKIE_SECURE;
const isSecureCookies =
  cookieSecureOverride !== undefined
    ? cookieSecureOverride === 'true'
    : isProd;

export function isSecureCookieEnv(): boolean {
  return isSecureCookies;
}

export function accessTokenCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: isSecureCookies,
    sameSite: isSecureCookies ? 'none' : 'lax',
    path: '/',
    maxAge: SEVEN_DAYS_MS,
  };
}

export function csrfCookieOptions(): CookieOptions {
  return {
    httpOnly: false,
    secure: isSecureCookies,
    sameSite: isSecureCookies ? 'none' : 'lax',
    path: '/',
    maxAge: SEVEN_DAYS_MS,
  };
}

export function oauthLoginStateCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: isSecureCookies,
    sameSite: 'lax',
    path: '/',
    maxAge: FIVE_MINUTES_MS,
  };
}

export function clearCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: isSecureCookies,
    sameSite: isSecureCookies ? 'none' : 'lax',
    path: '/',
  };
}