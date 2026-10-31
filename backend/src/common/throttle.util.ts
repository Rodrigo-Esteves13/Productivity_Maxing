import { SetMetadata } from '@nestjs/common';
import type { ThrottlerGetTrackerFunction } from '@nestjs/throttler';
import { MS_PER_MINUTE } from './time.constants';

// Janela unica do throttler (antes era o literal 60000 repetido em ~80
// decoradores). Os limites ficam em cada rota, que e onde se decide quanto
// cada uma aguenta.
export const THROTTLE_WINDOW_MS = MS_PER_MINUTE;
export const DEFAULT_REQUESTS_PER_MINUTE = 100;

// Uso: @Throttle(perMinute(5))
export function perMinute(limit: number) {
  return { default: { limit, ttl: THROTTLE_WINDOW_MS } };
}

// Igual, mas a contar por outra chave que nao o IP (ex: a sessao do
// dispositivo no POST /auth/refresh). O tracker devolve o IP quando nao tem
// nada melhor, por isso nunca fica sem limite.
export function perMinuteTrackedBy(
  limit: number,
  getTracker: ThrottlerGetTrackerFunction,
) {
  return { default: { limit, ttl: THROTTLE_WINDOW_MS, getTracker } };
}

// Trackers que nao sao um IP comecam por isto: o LoggingThrottlerGuard usa
// entao o req.ip no SecurityLog (o id de uma sessao nao e um IP).
export const NON_IP_TRACKER_PREFIX = 'tracker:';

// Teto por IP somado ao limite normal de uma rota (ver ThrottleIpCeiling).
export const THROTTLE_IP_CEILING_KEY = 'pmaxing:throttle-ip-ceiling';
export const IP_CEILING_KEY_SUFFIX = ':ip-ceiling';

/**
 * Teto por IP, por minuto, para uma rota cujo limite normal conta por outra
 * chave (perMinuteTrackedBy): sem isto, quem rodasse chaves (sessoes novas,
 * cookies forjados caem no IP) ficava sem limite global. Aplicado pelo
 * LoggingThrottlerGuard, com a mesma janela.
 */
export const ThrottleIpCeiling = (limit: number) =>
  SetMetadata(THROTTLE_IP_CEILING_KEY, limit);
