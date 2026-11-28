import { CanceledError } from 'axios';
import { forgetInFlightGets } from './dedupeGets';

// Cache de GETs por chave, so em memoria e so desta tab (F-16, F-47).
//
// - Fresco (idade < freshMs): devolve a copia guardada, sem rede.
// - Velho (freshMs <= idade < staleMs): devolve a copia guardada e pede de
//   novo em segundo plano (stale-while-revalidate). A resposta nova fica para
//   o proximo pedido; se mudou, corre onRevalidated (ex: avisar os cartoes) e
//   entrega-a a quem subscreveu a chave (subscribeToRevalidated).
// - Expirado ou sem entrada: vai a rede. Pedidos iguais em voo partilham um so.
//
// Regras de seguranca:
// - Cada chamador recebe a sua copia (clone da query): ninguem muta o valor
//   guardado.
// - invalidateQueries (escritas, ver mutationInvalidation.ts) apaga as
//   entradas e solta os pedidos em voo: um pedido iniciado antes da
//   invalidacao entrega a resposta a quem ja esperava, mas nunca a guarda.
// - clearQueryCache (logout, 401, troca de utilizador) apaga tudo, incluindo
//   o "ultimo conhecido", e solta tudo o que esta em voo.
// - O signal de cada chamador so cancela a espera dele. O pedido de rede so
//   e cancelado quando TODOS os que esperam cancelaram.
//
// Entre separadores: cada invalidacao local e avisada por BroadcastChannel
// (so a palavra "invalidar"/"limpar", nunca dados). Sem BroadcastChannel
// (browsers antigos) vale o TTL curto de cada query.

export interface QueryOptions<T> {
  // Ate esta idade a copia guardada serve sem ir a rede.
  freshMs: number;
  // Ate esta idade a copia guardada serve, mas pede-se de novo por tras.
  // Igual a freshMs = sem stale-while-revalidate.
  staleMs: number;
  // Copia entregue a cada chamador (o valor guardado nunca sai).
  clone: (value: T) => T;
  // Guarda tambem o "ultimo conhecido" (ver peekLastKnown).
  keepLastKnown?: boolean;
  // Chamado quando uma revalidacao em segundo plano trouxe dados diferentes.
  onRevalidated?: () => void;
}

export interface CachedQueryCall {
  signal?: AbortSignal;
  // Ignora a copia guardada e qualquer pedido em voo mais antigo.
  force?: boolean;
}

interface Entry {
  value: unknown;
  fetchedAt: number;
  expiresAt: number;
}

interface Flight {
  promise: Promise<unknown>;
  controller: AbortController;
  waiters: number;
  // Revalidacao em segundo plano: ninguem espera, nao se cancela por abort.
  background: boolean;
  settled: boolean;
}

interface LastKnown {
  value: unknown;
  fetchedAt: number;
}

const BROADCAST_CHANNEL_NAME = 'pm-query-cache';
type BroadcastMessage = 'invalidate' | 'clear';

const entries = new Map<string, Entry>();
const inFlight = new Map<string, Flight>();
const lastKnown = new Map<string, LastKnown>();
const revalidationListeners = new Map<string, Set<(value: unknown) => void>>();
let owner: string | null = null;
let channel: BroadcastChannel | null | undefined;

function now(): number {
  return Date.now();
}

function getChannel(): BroadcastChannel | null {
  if (channel !== undefined) return channel;
  channel = null;
  if (typeof BroadcastChannel === 'undefined') return channel;
  try {
    const created = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
    created.onmessage = (event: MessageEvent<BroadcastMessage>) => applyRemote(event.data);
    // Em Node (testes) o canal nao deve manter o processo vivo.
    (created as unknown as { unref?: () => void }).unref?.();
    channel = created;
  } catch {
    channel = null;
  }
  return channel;
}

function broadcast(message: BroadcastMessage): void {
  try {
    getChannel()?.postMessage(message);
  } catch {
    // Canal fechado: os outros separadores ficam com o TTL.
  }
}

// Mensagem de outro separador: so mexe nesta tab, sem reenviar.
function applyRemote(message: BroadcastMessage): void {
  if (message === 'clear') dropEverything();
  else if (message === 'invalidate') {
    forgetInFlightGets();
    dropMatching(() => true, false);
  }
}

function sweep(at: number): void {
  for (const [key, entry] of entries) {
    if (entry.expiresAt <= at) entries.delete(key);
  }
}

function canceled(): CanceledError<unknown> {
  return new CanceledError(undefined);
}

function startFlight<T>(
  key: string,
  fetcher: (signal: AbortSignal) => Promise<T>,
  options: QueryOptions<T>,
  background: boolean,
): Flight {
  const controller = new AbortController();
  const flight: Flight = { promise: Promise.resolve(), controller, waiters: 0, background, settled: false };
  const previous = entries.get(key);
  flight.promise = fetcher(controller.signal).then(
    (value) => {
      flight.settled = true;
      // Solto por uma invalidacao, um clear ou um force: nao guarda nada.
      if (inFlight.get(key) !== flight) return value;
      inFlight.delete(key);
      const at = now();
      entries.set(key, { value, fetchedAt: at, expiresAt: at + options.staleMs });
      if (options.keepLastKnown) lastKnown.set(key, { value, fetchedAt: at });
      sweep(at);
      if (background && previous && !sameJson(previous.value, value)) {
        options.onRevalidated?.();
        for (const listener of revalidationListeners.get(key) ?? []) listener(options.clone(value as T));
      }
      return value;
    },
    (error: unknown) => {
      flight.settled = true;
      if (inFlight.get(key) === flight) inFlight.delete(key);
      throw error;
    },
  );
  inFlight.set(key, flight);
  return flight;
}

function sameJson(a: unknown, b: unknown): boolean {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

// Espera pelo pedido partilhado com o signal deste chamador. Quando o
// ultimo que espera desiste, o pedido de rede e cancelado e solto.
function waitFor<T>(key: string, flight: Flight, clone: (value: T) => T, signal?: AbortSignal): Promise<T> {
  if (signal?.aborted) return Promise.reject(canceled());
  flight.waiters += 1;
  return new Promise<T>((resolve, reject) => {
    let done = false;
    const leave = () => {
      done = true;
      flight.waiters -= 1;
      signal?.removeEventListener('abort', onAbort);
    };
    const onAbort = () => {
      if (done) return;
      leave();
      if (flight.waiters === 0 && !flight.background && !flight.settled) {
        if (inFlight.get(key) === flight) inFlight.delete(key);
        flight.controller.abort();
      }
      reject(canceled());
    };
    signal?.addEventListener('abort', onAbort);
    flight.promise.then(
      (value) => {
        if (done) return;
        leave();
        resolve(clone(value as T));
      },
      (error: unknown) => {
        if (done) return;
        leave();
        reject(error);
      },
    );
  });
}

function revalidate<T>(key: string, fetcher: (signal: AbortSignal) => Promise<T>, options: QueryOptions<T>): void {
  if (inFlight.has(key)) return;
  // Falha em segundo plano: a copia velha continua ate expirar.
  startFlight(key, fetcher, options, true).promise.catch(() => undefined);
}

/**
 * Le `key` da cache ou da rede (ver regras no topo do ficheiro). O fetcher
 * recebe um signal proprio (cancelado so quando ninguem espera).
 */
export function cachedQuery<T>(
  key: string,
  fetcher: (signal: AbortSignal) => Promise<T>,
  options: QueryOptions<T>,
  call: CachedQueryCall = {},
): Promise<T> {
  const { signal, force = false } = call;
  if (signal?.aborted) return Promise.reject(canceled());
  getChannel();
  const at = now();
  const entry = entries.get(key);
  if (entry && !force) {
    const age = at - entry.fetchedAt;
    if (age < options.freshMs) return Promise.resolve(options.clone(entry.value as T));
    if (age < options.staleMs) {
      revalidate(key, fetcher, options);
      return Promise.resolve(options.clone(entry.value as T));
    }
    entries.delete(key);
  }
  if (force) entries.delete(key);
  let flight = inFlight.get(key);
  // Com force, um pedido em voo mais antigo pode ja nao refletir o que se
  // quer ver: comeca outro (o antigo entrega a quem esperava, sem guardar).
  if (!flight || force) flight = startFlight(key, fetcher, options, false);
  return waitFor(key, flight, options.clone, signal);
}

export interface InvalidateOptions {
  // Escrita que o proprio servico vai corrigir no "ultimo conhecido" (ver
  // patchLastKnown): nao o apaga.
  keepLastKnown?: boolean;
  // Avisar os outros separadores (false quando o aviso veio deles).
  broadcast?: boolean;
}

function dropMatching(match: (key: string) => boolean, keepKnown: boolean): void {
  for (const key of [...entries.keys()]) {
    if (!match(key)) continue;
    entries.delete(key);
  }
  for (const [key, flight] of [...inFlight]) {
    if (!match(key)) continue;
    inFlight.delete(key);
    if (flight.waiters === 0) flight.controller.abort();
  }
  if (!keepKnown) {
    for (const key of [...lastKnown.keys()]) {
      if (match(key)) lastKnown.delete(key);
    }
  }
}

/**
 * Apaga as entradas cujas chaves passam no filtro (todas sem filtro) e
 * solta os pedidos em voo delas.
 */
export function invalidateQueries(match: (key: string) => boolean = () => true, options: InvalidateOptions = {}): void {
  dropMatching(match, options.keepLastKnown ?? false);
  if (options.broadcast ?? true) broadcast('invalidate');
}

function dropEverything(): void {
  entries.clear();
  lastKnown.clear();
  for (const flight of inFlight.values()) {
    if (flight.waiters === 0) flight.controller.abort();
  }
  inFlight.clear();
  forgetInFlightGets();
}

/** Apaga tudo (logout, sessao terminada, troca de utilizador). */
export function clearQueryCache(options: { broadcast?: boolean } = {}): void {
  dropEverything();
  if (options.broadcast ?? true) broadcast('clear');
}

/**
 * Dono dos dados guardados (id do utilizador desta tab). Mudar de um
 * utilizador para outro, ou para nenhum, limpa a cache. De nenhum para um
 * utilizador nao limpa: o que se pediu antes do perfil chegar ja e dele.
 */
export function setQueryCacheOwner(userId: string | null): void {
  if (owner !== null && owner !== userId) clearQueryCache({ broadcast: false });
  owner = userId;
}

/**
 * Recebe (uma copia) do valor novo sempre que uma revalidacao em segundo plano
 * de `key` traz dados diferentes. Um pedido solto por uma escrita ou um clear
 * nunca chega aqui. Devolve o cancelamento.
 */
export function subscribeToRevalidated<T>(key: string, listener: (value: T) => void): () => void {
  const listeners = revalidationListeners.get(key) ?? new Set();
  revalidationListeners.set(key, listeners);
  const entry = listener as (value: unknown) => void;
  listeners.add(entry);
  return () => {
    listeners.delete(entry);
    if (listeners.size === 0 && revalidationListeners.get(key) === listeners) revalidationListeners.delete(key);
  };
}

/**
 * Ultimo valor conhecido de `key` (mesmo depois de invalidado por uma
 * escrita que o servico corrigiu), se nao for mais velho que maxAgeMs.
 * Serve so para contas aproximadas sem ir a rede (conquistas, F-18).
 */
export function peekLastKnown<T>(key: string, maxAgeMs: number, clone: (value: T) => T): T | undefined {
  const known = lastKnown.get(key);
  if (!known || now() - known.fetchedAt >= maxAgeMs) return undefined;
  return clone(known.value as T);
}

/** Aplica uma correcao ao ultimo valor conhecido (copia nova, nao muta). */
export function patchLastKnown<T>(key: string, patch: (value: T) => T): void {
  const known = lastKnown.get(key);
  if (!known) return;
  lastKnown.set(key, { value: patch(known.value as T), fetchedAt: known.fetchedAt });
}

/** Esquece o ultimo valor conhecido (correcao impossivel de aplicar). */
export function forgetLastKnown(key: string): void {
  lastKnown.delete(key);
}

// So para testes: estado inicial, sem canal.
export function resetQueryCacheForTests(): void {
  dropEverything();
  revalidationListeners.clear();
  owner = null;
  channel?.close();
  channel = undefined;
}

// So para testes: simula uma mensagem de outro separador.
export function receiveBroadcastForTests(message: BroadcastMessage): void {
  applyRemote(message);
}
