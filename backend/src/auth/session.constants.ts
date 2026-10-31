// Tempos de vida dos tokens de sessao (ver UserSessionsService e
// SessionTokenService). Num so sitio para o cookie, o JWT e a BD nunca
// discordarem.

const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const MS_PER_DAY = 24 * 60 * 60 * MS_PER_SECOND;

// JWT de acesso: curto, porque nao e consultado na BD a cada pedido (so a
// cache de 30s do SessionStateService). Expirado, o frontend pede um novo em
// POST /auth/refresh sem o utilizador dar por nada.
export const ACCESS_TOKEN_TTL_SECONDS = 15 * SECONDS_PER_MINUTE;

// Refresh token: validade deslizante (cada refresh adia o fim). Um
// dispositivo parado mais do que isto tem de voltar a fazer login.
export const REFRESH_TOKEN_TTL_MS = 30 * MS_PER_DAY;

// Linhas revogadas ficam este tempo (auditoria curta, ex: perceber uma
// reutilizacao de token) antes da limpeza periodica as apagar.
export const REVOKED_SESSION_RETENTION_MS = 7 * MS_PER_DAY;

// Tolerancia a uma resposta de refresh perdida (separador fechado, rede
// caiu depois do commit): durante este tempo, o token IMEDIATAMENTE anterior
// de uma sessao ainda roda uma vez em vez de contar como reutilizacao. Ver
// UserSessionsService (memoria so desta instancia, perde-se num restart).
export const GRACE_WINDOW_MS = 2 * SECONDS_PER_MINUTE * MS_PER_SECOND;

// Teto de sessoes lembradas para essa tolerancia. Cheio, esquece a rotacao
// mais antiga (que volta ao comportamento estrito, nunca ao contrario).
export const MAX_GRACE_ENTRIES = 5_000;

// Limites do que se guarda sobre o dispositivo (ver session-client.util.ts).
export const USER_AGENT_MAX_LENGTH = 255;
