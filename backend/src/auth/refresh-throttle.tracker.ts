import { REFRESH_TOKEN_COOKIE } from './cookie.config';
import { RefreshTokenCodec } from './refresh-token.codec';
import { NON_IP_TRACKER_PREFIX } from '../common/throttle.util';

// Prefixo da chave do throttler quando conta por sessao de dispositivo.
export const REFRESH_SESSION_TRACKER_PREFIX = `${NON_IP_TRACKER_PREFIX}refresh-session:`;

// Codec criado a primeira vez que e preciso (o JWT_SECRET ja esta carregado
// nessa altura) e recriado se a secret mudar (testes).
let cached: { secret: string; codec: RefreshTokenCodec } | undefined;

function codecFor(secret: string): RefreshTokenCodec {
  if (cached?.secret !== secret) {
    cached = { secret, codec: new RefreshTokenCodec(secret) };
  }
  return cached.codec;
}

interface TrackedRequest {
  ip?: string;
  cookies?: Record<string, unknown>;
}

/**
 * Chave do rate limit do POST /auth/refresh: a sessao do dispositivo do
 * cookie de refresh, so se o HMAC do token bater certo (emitido por este
 * servidor). Sem isto, muitos estudantes atras do mesmo NAT do campus
 * partilhavam um so limite por IP e levavam 429. Cookie em falta, mal
 * formado ou forjado: volta ao IP (o mesmo do tracker por omissao), por isso
 * inventar ids de sessao nao da limites novos. O teto por IP da rota (ver
 * ThrottleIpCeiling) continua a limitar o total vindo de um so IP.
 */
export function refreshThrottleTracker(req: TrackedRequest): string {
  const ip = req.ip ?? '';
  const secret = process.env.JWT_SECRET;
  const raw = req.cookies?.[REFRESH_TOKEN_COOKIE];
  if (!secret || typeof raw !== 'string') return ip;
  const sessionId = codecFor(secret).parse(raw);
  return sessionId ? `${REFRESH_SESSION_TRACKER_PREFIX}${sessionId}` : ip;
}
