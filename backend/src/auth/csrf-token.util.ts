// Formato do token que AuthService.generateCsrfToken() produz:
// randomBytes(32).toString('hex') = 64 caracteres hexadecimais.
const CSRF_TOKEN_PATTERN = /^[a-f0-9]{64}$/;

/**
 * True se o valor tem o formato de um token CSRF nosso. Serve para
 * GET /auth/csrf poder reutilizar o cookie que o browser ja tem (em vez
 * de o trocar por um novo) sem devolver lixo que alguem tenha posto no cookie.
 */
export function isWellFormedCsrfToken(value: unknown): value is string {
  return typeof value === 'string' && CSRF_TOKEN_PATTERN.test(value);
}
