import type { CookieOptions } from 'express';

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
  cookieSecureOverride !== undefined ? cookieSecureOverride === 'true' : isProd;

export function isSecureCookieEnv(): boolean {
  return isSecureCookies;
}

// Prefixo __Host-: o browser so aceita o cookie se for Secure, Path=/ e SEM
// atributo Domain, e impede que um subdominio irmao (app.pmaxing.pt, ou um
// subdominio esquecido de pmaxing.pt) defina um cookie com o mesmo nome por
// cima ("cookie tossing"). So se usa quando os cookies sao Secure (em
// desenvolvimento, sem HTTPS, o browser rejeitaria o prefixo). O frontend
// nunca le estes cookies pelo nome, por isso a mudanca fica toda aqui.
const HOST_PREFIX = isSecureCookies ? '__Host-' : '';

export const ACCESS_TOKEN_COOKIE = `${HOST_PREFIX}access_token`;
export const CSRF_COOKIE = `${HOST_PREFIX}csrf_token`;
export const OAUTH_LOGIN_STATE_COOKIE = `${HOST_PREFIX}oauth_login_state`;

// Frontend (app.pmaxing.pt) e API (api.pmaxing.pt) sao do MESMO site, por
// isso 'lax' chega para o frontend enviar os cookies nos seus pedidos, e o
// browser deixa de os enviar em pedidos iniciados por outros sites. 'none'
// so seria preciso com frontend e API em sites diferentes.
const SESSION_SAME_SITE = 'lax' as const;

export function accessTokenCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: isSecureCookies,
    sameSite: SESSION_SAME_SITE,
    path: '/',
    maxAge: SEVEN_DAYS_MS,
  };
}

export function csrfCookieOptions(): CookieOptions {
  return {
    httpOnly: false,
    secure: isSecureCookies,
    sameSite: SESSION_SAME_SITE,
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
    sameSite: SESSION_SAME_SITE,
    path: '/',
  };
}
