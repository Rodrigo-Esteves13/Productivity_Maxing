/**
 * Protecao CSRF do POST /auth/refresh. O double-submit do CsrfGuard nao
 * serve aqui: o refresh acontece justamente quando o frontend pode nao ter
 * o token CSRF em memoria (arranque da app com o JWT de acesso expirado).
 * Em vez disso:
 * - o cookie do refresh e SameSite=Lax e so vai para /auth/refresh, por isso
 *   um site de terceiros nunca o consegue enviar num POST;
 * - o header Origin (que os browsers poem sempre num POST cross-origin e que
 *   o JS nao consegue forjar) tem de ser o do frontend (verificacao de
 *   origem recomendada pela OWASP).
 * Um pedido sem Origin (nao vem de um browser a correr a app) e recusado.
 */
export function isAllowedRefreshOrigin(
  origin: string | undefined,
  frontendUrl: string,
): boolean {
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(frontendUrl).origin;
  } catch {
    return false;
  }
}
