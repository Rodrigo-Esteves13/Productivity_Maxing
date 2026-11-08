// Pedidos a Google Calendar API com retry. A sincronizacao em massa batia
// muitas vezes em 429/403 (rateLimitExceeded) e 5xx passageiros, e a pessoa
// tinha de carregar em "sync" varias vezes. Aqui volta-se a tentar com
// espera exponencial (respeitando Retry-After) antes de dar erro.
import { GOOGLE_API_TIMEOUT_MS } from '../common/http-resilience.constants';

export const GOOGLE_MAX_RETRIES = 4;
export const GOOGLE_RETRY_BASE_MS = 500;
export const GOOGLE_RETRY_MAX_MS = 8_000;
// Um pedido que estourou o timeout so e repetido isto de vezes: a Google
// pendurada faria cada operacao esperar GOOGLE_MAX_RETRIES timeouts e o
// sync inteiro demorar quase uma hora.
export const GOOGLE_MAX_TIMEOUT_RETRIES = 1;
const TIMEOUT_ERROR_NAME = 'TimeoutError';

const HTTP_FORBIDDEN = 403;
const HTTP_TOO_MANY_REQUESTS = 429;
const HTTP_SERVER_ERROR_MIN = 500;
const MS_PER_SECOND = 1000;
// 403 so e repetivel quando e limite de ritmo (nao falta de permissao).
const RATE_LIMIT_REASONS = ['rateLimitExceeded', 'userRateLimitExceeded'];

type Sleep = (ms: number) => Promise<void>;
const defaultSleep: Sleep = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

async function isRetryable(res: Response): Promise<boolean> {
  if (res.status === HTTP_TOO_MANY_REQUESTS) return true;
  if (res.status >= HTTP_SERVER_ERROR_MIN) return true;
  if (res.status !== HTTP_FORBIDDEN) return false;
  // clone(): quem chama ainda pode ler o corpo da resposta final.
  const body = await res
    .clone()
    .text()
    .catch(() => '');
  return RATE_LIMIT_REASONS.some((reason) => body.includes(reason));
}

export function retryDelayMs(
  attempt: number,
  retryAfter: string | null,
  random = Math.random,
): number {
  const seconds = retryAfter ? Number(retryAfter) : NaN;
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(seconds * MS_PER_SECOND, GOOGLE_RETRY_MAX_MS);
  }
  const exponential = GOOGLE_RETRY_BASE_MS * 2 ** attempt;
  // Jitter: pedidos em paralelo nao voltam a bater todos ao mesmo tempo.
  return Math.min(
    exponential + random() * GOOGLE_RETRY_BASE_MS,
    GOOGLE_RETRY_MAX_MS,
  );
}

const isTimeoutError = (error: unknown): boolean =>
  (error as { name?: string } | null)?.name === TIMEOUT_ERROR_NAME;

export async function googleFetch(
  url: string,
  init: RequestInit,
  sleep: Sleep = defaultSleep,
): Promise<Response> {
  let timeouts = 0;
  for (let attempt = 0; ; attempt++) {
    const isLast = attempt >= GOOGLE_MAX_RETRIES;
    let res: Response;
    try {
      // Timeout novo em cada tentativa: um pedido pendurado nao prende o sync.
      res = await fetch(url, {
        ...init,
        signal: init.signal ?? AbortSignal.timeout(GOOGLE_API_TIMEOUT_MS),
      });
    } catch (error) {
      // Falha de rede: repete; na ultima tentativa propaga. Timeout: no
      // maximo GOOGLE_MAX_TIMEOUT_RETRIES repeticoes.
      if (isTimeoutError(error) && timeouts++ >= GOOGLE_MAX_TIMEOUT_RETRIES) {
        throw error;
      }
      if (isLast) throw error;
      await sleep(retryDelayMs(attempt, null));
      continue;
    }
    if (isLast || !(await isRetryable(res))) return res;
    await sleep(retryDelayMs(attempt, res.headers.get('retry-after')));
  }
}
