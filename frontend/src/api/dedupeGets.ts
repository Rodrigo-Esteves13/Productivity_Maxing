import { CanceledError, type AxiosAdapter, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';

// Cancela so a espera de quem pediu, nao o pedido partilhado.
function abortable<T>(promise: Promise<T>, config: InternalAxiosRequestConfig): Promise<T> {
  const signal = config.signal;
  if (!signal) return promise;
  return new Promise<T>((resolve, reject) => {
    const cancel = () => reject(new CanceledError(undefined, config));
    if (signal.aborted) return cancel();
    signal.addEventListener?.('abort', cancel);
    promise.then(resolve, reject).finally(() => signal.removeEventListener?.('abort', cancel));
  });
}

// GETs iguais ao mesmo tempo (ex: o heatmap pedido pela dica e pelo cartao
// do Focus, o contador do Social pedido pela Navbar e pela pagina) partilham
// UM pedido de rede. So enquanto esta em voo: nada fica em cache, por isso
// nunca se le um dado velho. Cada chamador recebe a sua copia da resposta
// (o JSON e interpretado por chamador) e o seu proprio cancelamento.
export function dedupeGets(
  network: AxiosAdapter,
  keyOf: (config: InternalAxiosRequestConfig) => string,
): AxiosAdapter {
  const inFlight = new Map<string, Promise<AxiosResponse>>();
  return (config) => {
    if ((config.method ?? 'get').toLowerCase() !== 'get') return network(config);
    const key = `${keyOf(config)}|${config.responseType ?? ''}`;
    let shared = inFlight.get(key);
    if (!shared) {
      // Sem o signal de quem pediu primeiro: se esse cancelar, os outros
      // continuam a receber a resposta.
      shared = network({ ...config, signal: undefined }).finally(() => inFlight.delete(key));
      inFlight.set(key, shared);
    }
    return abortable(
      shared.then((response) => ({ ...response, config })),
      config,
    );
  };
}
