export interface JwtPayload {
  sub: string; // User.id (uuid)
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

export interface LinkStatePayload {
  sub: string;
  purpose: 'link';
  provider: string;
  iat?: number;
  exp?: number;
}

/**
 * Emitido só quando o login é recusado por SUSPENDED/BANNED (ver
 * AuthService.accountBlockedResponse) - curta duração (15 min), enviado
 * no CORPO da resposta (nunca como cookie), para o frontend conseguir
 * chamar GET /account-status/me e POST /appeals via "Authorization:
 * Bearer" SEM sessão nenhuma (ver JwtBlockedAwareStrategy). Mesmo shape
 * de JwtPayload + "purpose" a distinguir - nunca aceite por JwtStrategy
 * normal (essa só lê o cookie, nunca o header Authorization).
 */
export interface AppealTokenPayload {
  sub: string;
  email: string;
  role: string;
  purpose: 'appeal';
  iat?: number;
  exp?: number;
}
