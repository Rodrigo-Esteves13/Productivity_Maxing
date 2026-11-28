import { CanceledError, type AxiosAdapter, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';

interface Shared {
  promise: Promise<AxiosResponse>;
  controller: AbortController;
  waiters: number;
  // Alguem espera sem signal: o pedido nunca e cancelado por abort.
  pinned: boolean;
  settled: boolean;
}

// Cancela so a espera de quem pediu. Quando o ultimo que espera cancela (e
// todos tinham signal), cancela tambem o pedido de rede (F-47).
function abortable(
  shared: Shared,
  key: string,
  inFlight: Map<string, Shared>,
  config: InternalAxiosRequestConfig,
): Promise<AxiosResponse> {
  const signal = config.signal;
  if (!signal) {
    shared.pinned = true;
    return shared.promise.then((response) => ({ ...response, config }));
  }
  return new Promise<AxiosResponse>((resolve, reject) => {
    let done = false;
    const leave = () => {
      done = true;
      shared.waiters -= 1;
      signal.removeEventListener?.('abort', cancel);
    };
    const cancel = () => {
      if (done) return;
      leave();
      if (shared.waiters === 0 && !shared.pinned && !shared.settled) {
        if (inFlight.get(key) === shared) inFlight.delete(key);
        shared.controller.abort();
      }
      reject(new CanceledError(undefined, config));
    };
    shared.waiters += 1;
    if (signal.aborted) return cancel();
    signal.addEventListener?.('abort', cancel);
    shared.promise.then(
      (response) => {
        if (done) return;
        leave();
        resolve({ ...response, config });
      },
      (error: unknown) => {
        if (done) return;
        leave();
        reject(error);
      },
    );
  });
}

// Pedidos em voo de cada adapter criado.
const registries = new Set<Map<string, Shared>>();

// Depois de uma escrita ou do fim da sessao, um GET que ja estava em voo pode
// trazer dados velhos ou de outra conta: quem ja esperava recebe-o, mas as
// leituras seguintes fazem um pedido novo.
export function forgetInFlightGets(): void {
  for (const inFlight of registries) inFlight.clear();
}

// GETs iguais ao mesmo tempo (ex: o heatmap pedido pela dica e pelo cartao
// do Focus, o contador do Social pedido pela Navbar e pela pagina) partilham
// UM pedido de rede. So enquanto esta em voo: a cache com TTL vive em
// queryCache.ts. Cada chamador recebe a sua copia da resposta (o JSON e
// interpretado por chamador) e o seu proprio cancelamento.
export function dedupeGets(
  network: AxiosAdapter,
  keyOf: (config: InternalAxiosRequestConfig) => string,
): AxiosAdapter {
  const inFlight = new Map<string, Shared>();
  registries.add(inFlight);
  return (config) => {
    if ((config.method ?? 'get').toLowerCase() !== 'get') return network(config);
    const key = `${keyOf(config)}|${config.responseType ?? ''}`;
    let shared = inFlight.get(key);
    if (!shared) {
      // Signal proprio, nao o de quem pediu primeiro: se esse cancelar, os
      // outros continuam a receber a resposta.
      const controller = new AbortController();
      const created: Shared = {
        promise: Promise.resolve() as unknown as Promise<AxiosResponse>,
        controller,
        waiters: 0,
        pinned: false,
        settled: false,
      };
      created.promise = network({ ...config, signal: controller.signal }).finally(() => {
        created.settled = true;
        if (inFlight.get(key) === created) inFlight.delete(key);
      });
      // Sem ninguem a esperar (todos cancelaram) a rejeicao nao fica solta.
      created.promise.catch(() => undefined);
      inFlight.set(key, created);
      shared = created;
    }
    return abortable(shared, key, inFlight, config);
  };
}
