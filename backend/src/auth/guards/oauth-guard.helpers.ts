import { randomBytes, timingSafeEqual } from 'crypto';
import type { Request, Response } from 'express';
import { Provider } from '@prisma/client';
import { AuthService } from '../auth.service';
import {
  OAUTH_LOGIN_STATE_COOKIE,
  oauthLoginStateCookieOptions,
  isSecureCookieEnv,
} from '../cookie.config';

// Google/GitHub/Discord *AuthGuard tinham cada um a mesma lógica copiada:
// gerar um state aleatório e guardá-lo num cookie httpOnly no arranque do
// fluxo, e não mexer em nada no callback (deixar a Strategy usar o state
// que já veio do provider). Centralizado aqui para os 3 guards deixarem de
// divergir silenciosamente se um dia só um deles for corrigido.
//
// Proteção de login CSRF: o state aleatório é enviado ao provider e
// devolvido no callback; a Strategy correspondente compara-o com este
// cookie antes de aceitar o login.
//
// `extraOptions` cobre parâmetros específicos de um provider que têm de
// ir tanto no arranque como no callback (ex: accessType/prompt do Google).
export function buildLoginAuthenticateOptions(
  request: Request,
  response: Response,
  extraOptions: Record<string, unknown> = {},
): Record<string, unknown> {
  if (request.query.code) {
    return extraOptions;
  }

  const state = randomBytes(16).toString('hex');
  // httpOnly/secure repetidos aqui de forma explícita (em cima do que
  // oauthLoginStateCookieOptions() já define) só para o CodeQL conseguir
  // confirmar estaticamente as duas flags sem ter de atravessar a chamada
  // de função - o comportamento real não muda, os valores vêm de lá.
  response.cookie(OAUTH_LOGIN_STATE_COOKIE, state, {
    ...oauthLoginStateCookieOptions(),
    httpOnly: true,
    secure: isSecureCookieEnv(),
  });
  return { state, ...extraOptions };
}

// Google/GitHub/Discord *LinkGuard tinham a mesma lógica copiada: gerar o
// state assinado (createLinkState) a partir do utilizador já autenticado
// pelo JwtAuthGuard aplicado antes destes guards na rota, só variando o
// Provider e o scope pedido.
export function buildLinkAuthenticateOptions(
  authService: AuthService,
  request: Request & { user: { id: string } },
  provider: Provider,
  scope: string[],
): Record<string, unknown> {
  const state = authService.createLinkState(request.user.id, provider);
  return { state, scope };
}

/**
 * Compara o `state` devolvido pelo provider OAuth com o valor guardado no
 * cookie oauth_login_state, em tempo constante - a mesma defesa em
 * profundidade já usada pelo CsrfGuard (ver csrf.guard.ts) para a
 * comparação double-submit cookie. O state não é tão sensível como uma
 * password, mas é a única coisa que separa um login legítimo de um login
 * CSRF (RFC 6749 §10.12), e comparar com `!==`/`===` deixa (em teoria) um
 * side-channel de timing sobre quantos bytes iniciais coincidem. As 3
 * Strategies (Google/GitHub/Discord) usavam cada uma a sua própria
 * comparação direta - centralizado aqui para não voltarem a divergir.
 */
export function isValidLoginState(
  cookieState: string | undefined,
  returnedState: string | undefined,
): boolean {
  if (!cookieState || !returnedState) return false;

  const bufA = Buffer.from(cookieState);
  const bufB = Buffer.from(returnedState);

  if (bufA.length !== bufB.length) {
    timingSafeEqual(bufA, bufA);
    return false;
  }

  return timingSafeEqual(bufA, bufB);
}
