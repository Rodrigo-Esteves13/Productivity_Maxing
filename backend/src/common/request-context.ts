import { AsyncLocalStorage } from 'node:async_hooks';

interface RequestContext {
  requestId: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

/** Corre `fn` com o requestId disponivel via getRequestId() em toda a cadeia async. */
export function runWithRequestId<T>(requestId: string, fn: () => T): T {
  return storage.run({ requestId }, fn);
}

/** requestId do pedido em curso, ou undefined fora de um pedido (arranque, cron interno). */
export function getRequestId(): string | undefined {
  return storage.getStore()?.requestId;
}
