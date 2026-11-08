// Timeouts e circuit breakers dos clientes HTTP externos. Um fornecedor em
// baixo nao pode prender pedidos nem o cron: cada pedido tem um tempo maximo
// e, depois de varias falhas seguidas, o cliente deixa de tentar durante um
// bocado (falha logo e usa o caminho de recurso que ja existia).
import { MS_PER_MINUTE, MS_PER_SECOND } from './time.constants';

// Google Distance Matrix (commute e tempos de viagem do itinerario).
export const MAPS_TIMEOUT_MS = 8 * MS_PER_SECOND;
export const MAPS_BREAKER_FAILURE_THRESHOLD = 3;
export const MAPS_BREAKER_OPEN_MS = MS_PER_MINUTE;

// Cotacoes (Yahoo). O timeout fica em finance.constants (QUOTE_TIMEOUT_MS).
export const QUOTE_BREAKER_FAILURE_THRESHOLD = 5;
export const QUOTE_BREAKER_OPEN_MS = 5 * MS_PER_MINUTE;

// Web push (FCM, Mozilla, Windows, Apple): um breaker por servico de push.
export const PUSH_TIMEOUT_MS = 10 * MS_PER_SECOND;
export const PUSH_BREAKER_FAILURE_THRESHOLD = 5;
export const PUSH_BREAKER_OPEN_MS = MS_PER_MINUTE;

// Google Calendar API (por tentativa; googleFetch ja repete com backoff).
export const GOOGLE_API_TIMEOUT_MS = 15 * MS_PER_SECOND;
// Endpoints OAuth (token, revoke, tokeninfo, GitHub emails): so timeout.
export const OAUTH_HTTP_TIMEOUT_MS = 10 * MS_PER_SECOND;

// Respostas HTTP que contam como falha do fornecedor (nao do pedido).
export const HTTP_TOO_MANY_REQUESTS = 429;
export const HTTP_SERVER_ERROR_MIN = 500;

export function isProviderFailureStatus(status: number): boolean {
  return status === HTTP_TOO_MANY_REQUESTS || status >= HTTP_SERVER_ERROR_MIN;
}
