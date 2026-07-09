import type { CookieOptions } from 'express';

// Nomes e opções dos cookies de autenticação.
// Centralizado aqui para o controller, a JwtStrategy e o CsrfGuard usarem
// sempre exatamente o mesmo nome/opções (evita bugs de "esqueci-me de mudar
// num sítio").

export const ACCESS_TOKEN_COOKIE = 'access_token';
export const CSRF_COOKIE = 'csrf_token';
// Cookie de curta duração usado só durante o fluxo OAuth de login (não o de
// "ligar conta", que já tinha o seu próprio state assinado). Protege contra
// login CSRF (RFC 6749 §10.12): sem isto, um atacante conseguia iniciar o
// fluxo OAuth com a própria conta dele e forçar a vítima a completar o
// callback com o código do atacante, autenticando a vítima na sessão do
// atacante sem ela perceber.
export const OAUTH_LOGIN_STATE_COOKIE = 'oauth_login_state';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const FIVE_MINUTES_MS = 5 * 60 * 1000;

// Em produção o frontend (Netlify) e o backend (Render/Railway) vivem em
// domínios diferentes, por isso o cookie tem de ser SameSite=None (+Secure,
// que é obrigatório sempre que SameSite=None). Em desenvolvimento local
// (http://localhost) usamos Lax + Secure=false, porque o browser rejeita
// SameSite=None sem HTTPS.
const isProd = process.env.NODE_ENV === 'production';

// Exportado para os sítios que definem cookies "à mão" fora deste ficheiro
// (ex: oauth-guard.helpers.ts) poderem repetir explicitamente a flag
// `secure` na própria chamada a response.cookie(), em vez de a herdarem só
// via spread de *CookieOptions() - alguns scanners estáticos (CodeQL) não
// atravessam a fronteira de uma função importada para confirmar o valor,
// e sinalizam falso-positivo se não virem `secure`/`httpOnly` explícitos
// na mesma expressão da chamada.
export function isSecureCookieEnv(): boolean {
  return isProd;
}

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

// Curto (5 min, chega para o utilizador completar o consent no provider),
// httpOnly (nunca precisa de ser lido por JS) e SameSite=Lax: tem de
// sobreviver à navegação top-level de volta do provider para o nosso
// callback, o que SameSite=Strict/None-sem-secure-em-dev não garantiria
// em todos os browsers.
export function oauthLoginStateCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: FIVE_MINUTES_MS,
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
