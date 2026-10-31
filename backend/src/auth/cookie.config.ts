import type { CookieOptions } from 'express';
import { REFRESH_TOKEN_TTL_MS } from './session.constants';

const FIVE_MINUTES_MS = 5 * 60 * 1000;

// O refresh token so e enviado para esta rota (Path restrito): nunca viaja
// nos outros pedidos da app.
export const REFRESH_TOKEN_PATH = '/auth/refresh';

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
// O cookie do refresh token tem Path=/auth/refresh, que o prefixo __Host-
// proibe (exige Path=/). __Secure- continua a obrigar a Secure, e o cookie
// nao leva Domain, por isso fica na mesma preso ao host da API.
const SECURE_PREFIX = isSecureCookies ? '__Secure-' : '';

export const ACCESS_TOKEN_COOKIE = `${HOST_PREFIX}access_token`;
export const CSRF_COOKIE = `${HOST_PREFIX}csrf_token`;
export const OAUTH_LOGIN_STATE_COOKIE = `${HOST_PREFIX}oauth_login_state`;
export const REFRESH_TOKEN_COOKIE = `${SECURE_PREFIX}refresh_token`;

// Frontend (app.pmaxing.pt) e API (api.pmaxing.pt) sao do MESMO site, por
// isso 'lax' chega para o frontend enviar os cookies nos seus pedidos, e o
// browser deixa de os enviar em pedidos iniciados por outros sites. 'none'
// so seria preciso com frontend e API em sites diferentes.
const SESSION_SAME_SITE = 'lax' as const;

// O JWT la dentro so vale 15 minutos (ACCESS_TOKEN_TTL_SECONDS), mas o
// cookie dura o mesmo que o refresh: o logout precisa de ler a claim `sid`
// de um JWT ja expirado para saber que sessao terminar (a assinatura
// continua a ser verificada). Um JWT expirado nunca autentica nada.
export function accessTokenCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: isSecureCookies,
    sameSite: SESSION_SAME_SITE,
    path: '/',
    maxAge: REFRESH_TOKEN_TTL_MS,
  };
}

// Mesma validade do refresh: depois de um refresh o frontend volta a ter o
// mesmo token CSRF (o cookie e reutilizado, ver AuthController.refresh).
export function csrfCookieOptions(): CookieOptions {
  return {
    httpOnly: false,
    secure: isSecureCookies,
    sameSite: SESSION_SAME_SITE,
    path: '/',
    maxAge: REFRESH_TOKEN_TTL_MS,
  };
}

export function refreshTokenCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: isSecureCookies,
    sameSite: SESSION_SAME_SITE,
    path: REFRESH_TOKEN_PATH,
    maxAge: REFRESH_TOKEN_TTL_MS,
  };
}

// Apagar um cookie exige o mesmo Path com que foi criado.
export function clearRefreshCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: isSecureCookies,
    sameSite: SESSION_SAME_SITE,
    path: REFRESH_TOKEN_PATH,
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
