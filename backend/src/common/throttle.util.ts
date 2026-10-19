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
