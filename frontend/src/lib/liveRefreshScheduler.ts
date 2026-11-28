// Coordenador dos refrescos "ao vivo" (F-23): todos os pedidos de refresco
// passam por uma fila unica e saem um de cada vez, com LIVE_STAGGER_MS de
// intervalo, em vez de uma rajada quando o separador volta a ter foco. Sem
// React nem DOM, para se poder testar (ver useLiveRefresh).

// Dois disparos (foco, visibilidade, tick) do mesmo ecra mais perto do que
// isto contam como um.
export const LIVE_MIN_GAP_MS = 2000;
// Espaco entre pedidos de ecras/cartoes diferentes.
export const LIVE_STAGGER_MS = 150;

export interface LiveRefreshHandle {
  /** Foco, visibilidade ou tick: so corre visivel e respeita LIVE_MIN_GAP_MS. */
  request: () => void;
  /** Push do service worker: corre sempre (tambem escondido, sem intervalo minimo). */
  push: () => void;
  unregister: () => void;
}

interface Subscriber {
  run: () => void;
  lastRunAt: number;
  queued: boolean;
  forced: boolean;
}

export function createLiveRefreshScheduler(isVisible: () => boolean) {
  const subscribers = new Set<Subscriber>();
  const queue: Subscriber[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;

  const drain = (): void => {
    timer = null;
    let next = queue.shift();
    while (next) {
      next.queued = false;
      const forced = next.forced;
      next.forced = false;
      if (forced || isVisible()) {
        if (!forced) next.lastRunAt = Date.now();
        // O temporizador fica marcado antes de correr: um erro num refresco
        // nao para a fila.
        timer = setTimeout(drain, LIVE_STAGGER_MS);
        next.run();
        return;
      }
      next = queue.shift();
    }
  };

  const enqueue = (subscriber: Subscriber, forced: boolean): void => {
    if (!subscribers.has(subscriber)) return;
    if (!forced && (!isVisible() || Date.now() - subscriber.lastRunAt < LIVE_MIN_GAP_MS)) return;
    subscriber.forced = subscriber.forced || forced;
    if (subscriber.queued) return;
    subscriber.queued = true;
    queue.push(subscriber);
  };

  const start = (): void => {
    if (timer === null) drain();
  };

  const dispatch = (targets: Subscriber[], forced: boolean): void => {
    // Entram todos na fila antes de correr o primeiro: um erro nele nao
    // deixa os outros de fora.
    for (const subscriber of targets) enqueue(subscriber, forced);
    start();
  };

  return {
    register(run: () => void): LiveRefreshHandle {
      const subscriber: Subscriber = { run, lastRunAt: Number.NEGATIVE_INFINITY, queued: false, forced: false };
      subscribers.add(subscriber);
      return {
        request: () => dispatch([subscriber], false),
        push: () => dispatch([subscriber], true),
        unregister: () => {
          subscribers.delete(subscriber);
          const index = queue.indexOf(subscriber);
          if (index >= 0) queue.splice(index, 1);
        },
      };
    },
    /** Aplica um disparo a todos os registados, por ordem de registo. */
    requestAll: (): void => dispatch([...subscribers], false),
    pushAll: (): void => dispatch([...subscribers], true),
    size: (): number => subscribers.size,
  };
}
