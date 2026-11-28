import { useCallback, useSyncExternalStore } from 'react';

// Estado guardado no localStorage (F-30). Todas as instancias da mesma chave,
// nesta tab (listeners) e nas outras (evento `storage`), veem o mesmo valor.
// So escreve quando alguem muda o valor, nunca ao montar. Se o storage
// recusar a escrita (bloqueado, cheio), o valor fica em memoria nesta tab.

export interface PersistedCodec<T> {
  // Recebe o texto guardado (null se nao ha nada) e devolve um valor valido.
  parse: (raw: string | null) => T;
  // Texto a guardar; null apaga a chave. Por omissao String(value).
  serialize?: (value: T) => string | null;
}

interface CacheEntry {
  raw: string | null;
  codec: unknown;
  value: unknown;
}

// Mesmo texto guardado => mesmo objeto (o useSyncExternalStore exige-o).
const cache = new Map<string, CacheEntry>();
const unsaved = new Map<string, unknown>();
const listeners = new Map<string, Set<() => void>>();

export function readPersisted<T>(key: string, codec: PersistedCodec<T>): T {
  if (unsaved.has(key)) return unsaved.get(key) as T;
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(key);
  } catch {
    // Sem storage: vale o valor por omissao.
  }
  const hit = cache.get(key);
  if (hit && hit.raw === raw && hit.codec === codec) return hit.value as T;
  let value: T;
  try {
    value = codec.parse(raw);
  } catch {
    value = codec.parse(null);
  }
  cache.set(key, { raw, codec, value });
  return value;
}

export function writePersisted<T>(key: string, codec: PersistedCodec<T>, value: T): void {
  try {
    const raw = codec.serialize ? codec.serialize(value) : String(value);
    if (raw === null) localStorage.removeItem(key);
    else localStorage.setItem(key, raw);
    unsaved.delete(key);
    cache.set(key, { raw, codec, value });
  } catch {
    unsaved.set(key, value);
  }
  listeners.get(key)?.forEach((listener) => listener());
}

function subscribeToKey(key: string, listener: () => void): () => void {
  const forKey = listeners.get(key) ?? new Set<() => void>();
  listeners.set(key, forKey.add(listener));
  // key null: outra tab fez localStorage.clear().
  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== key) return;
    unsaved.delete(key);
    listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    forKey.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

// `codec` tem de ser uma constante de modulo (ou estavel entre renders).
export function usePersistedState<T>(key: string, codec: PersistedCodec<T>) {
  const subscribe = useCallback((listener: () => void) => subscribeToKey(key, listener), [key]);
  const value = useSyncExternalStore(
    subscribe,
    () => readPersisted(key, codec),
    () => codec.parse(null),
  );

  // Como o setState: aceita o valor novo ou uma funcao sobre o atual.
  const setValue = useCallback(
    (next: T | ((previous: T) => T)) => {
      const resolved =
        typeof next === 'function' ? (next as (previous: T) => T)(readPersisted(key, codec)) : next;
      writePersisted(key, codec, resolved);
    },
    [key, codec],
  );

  return [value, setValue] as const;
}

// Booleanos guardados como "true" / "false".
export const OFF_BY_DEFAULT: PersistedCodec<boolean> = { parse: (raw) => raw === 'true' };
export const ON_BY_DEFAULT: PersistedCodec<boolean> = { parse: (raw) => raw !== 'false' };
