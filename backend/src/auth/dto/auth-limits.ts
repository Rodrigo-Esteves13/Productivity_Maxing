import { MS_PER_MINUTE, MS_PER_SECOND } from '../../common/time.constants';

// Limites partilhados pelos DTOs de registo e login (um so sitio).
// 254 = maximo pratico de um endereco de email (RFC 5321).
export const EMAIL_MAX_LENGTH = 254;
export const PASSWORD_MIN_LENGTH = 8;
// Limite pratico para o hash (scrypt/bcrypt) nao crescer sem necessidade.
export const PASSWORD_MAX_LENGTH = 72;

// Rate limits das rotas de sessao (por IP, por minuto). O refresh tem folga
// para varias tabs a arrancar ao mesmo tempo; revogar e mais apertado.
// Excecao: o refresh conta por sessao de dispositivo (ver
// refresh-throttle.tracker.ts), com um teto por IP largo o bastante para um
// campus inteiro atras de um NAT, mas que continua a travar abuso.
export const REFRESH_REQUESTS_PER_MINUTE = 30;
export const REFRESH_IP_CEILING_PER_MINUTE = 300;
export const SESSION_REVOKE_REQUESTS_PER_MINUTE = 20;
export const SESSION_REVOKE_OTHERS_REQUESTS_PER_MINUTE = 5;
// Export "Download my security activity" (pagina Devices): le varias tabelas,
// por isso um teto baixo chega e sobra para o uso normal.
export const SECURITY_ACTIVITY_EXPORT_REQUESTS_PER_MINUTE = 5;

// API Keys (x-api-key, ver ApiKeyService e api-key-failure.tracker.ts).
// Cache curta de key valida para user+scope: o agente faz poll e cada pedido
// pagava um scrypt e uma leitura na BD. Revogar invalida logo nesta
// instancia; o TTL curto cobre o resto (user apagado, mudanca de role).
export const API_KEY_CACHE_TTL_MS = 60 * MS_PER_SECOND;
export const API_KEY_CACHE_MAX_ENTRIES = 1_000;
// lastUsed so e gravado se a ultima escrita tiver mais do que isto.
export const API_KEY_LAST_USED_DEBOUNCE_MS = 5 * MS_PER_MINUTE;
// Falhas de API key por IP: passado o teto, o pedido leva 429 antes do
// scrypt ate a janela acabar. Folga larga para um script mal configurado.
export const API_KEY_FAILURE_WINDOW_MS = 10 * MS_PER_MINUTE;
export const API_KEY_MAX_FAILURES_PER_WINDOW = 20;
export const API_KEY_FAILURE_MAX_TRACKED_IPS = 10_000;
