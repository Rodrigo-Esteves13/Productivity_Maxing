// O projeto nao tem jsdom nem testing-library (ver AuthContext.retry.test):
// para testar hooks no vitest, o React e trocado por este shim minimo.
//
// Uso num ficheiro de teste:
//   vi.mock('react', async (importOriginal) =>
//     (await import('../test/hookHarness')).reactShim(await importOriginal()));

interface Instance {
  slots: unknown[];
  index: number;
  pendingEffects: Map<number, () => void | (() => void)>;
  busy: boolean;
  dirty: boolean;
  mounted: boolean;
  render: () => void;
}

interface EffectSlot {
  deps?: unknown[];
  cleanup?: void | (() => void);
}

let active: Instance;
// Passagens maximas de um render: apanha loops (ex: dependencia instavel).
const MAX_PASSES = 50;

function depsChanged(a?: unknown[], b?: unknown[]): boolean {
  return !a || !b || a.length !== b.length || a.some((x, i) => !Object.is(x, b[i]));
}

function useState<T>(initial: T | (() => T)) {
  const instance = active;
  const i = instance.index++;
  if (!instance.slots[i]) {
    const cell = {
      value: typeof initial === 'function' ? (initial as () => T)() : initial,
      set: (next: T | ((prev: T) => T)) => {
        if (!instance.mounted) return;
        const value = typeof next === 'function' ? (next as (prev: T) => T)(cell.value) : next;
        if (Object.is(cell.value, value)) return;
        cell.value = value;
        instance.render();
      },
    };
    instance.slots[i] = cell;
  }
  const cell = instance.slots[i] as { value: T; set: (next: T | ((prev: T) => T)) => void };
  return [cell.value, cell.set] as const;
}

function useRef<T>(initial: T) {
  const i = active.index++;
  active.slots[i] ??= { current: initial };
  return active.slots[i] as { current: T };
}

function useMemo<T>(factory: () => T, deps: unknown[]): T {
  const i = active.index++;
  const slot = active.slots[i] as { value: T; deps: unknown[] } | undefined;
  if (slot && !depsChanged(slot.deps, deps)) return slot.value;
  const value = factory();
  active.slots[i] = { value, deps };
  return value;
}

function useCallback<T>(fn: T, deps: unknown[]): T {
  return useMemo(() => fn, deps);
}

function useEffect(effect: () => void | (() => void), deps?: unknown[]) {
  const i = active.index++;
  const slot = (active.slots[i] ??= {}) as EffectSlot & { ran?: boolean };
  if (!slot.ran || depsChanged(slot.deps, deps)) {
    slot.ran = true;
    slot.deps = deps;
    active.pendingEffects.set(i, effect);
  }
}

function useSyncExternalStore<T>(subscribe: (listener: () => void) => () => void, getSnapshot: () => T): T {
  const instance = active;
  const value = getSnapshot();
  const latest = useRef({ value, getSnapshot });
  latest.current = { value, getSnapshot };
  useEffect(() => {
    const check = () => {
      if (!Object.is(latest.current.getSnapshot(), latest.current.value)) instance.render();
    };
    const unsubscribe = subscribe(check);
    check();
    return unsubscribe;
  }, [subscribe]);
  return value;
}

export function reactShim<T extends object>(actual: T) {
  const shim = { useState, useRef, useMemo, useCallback, useEffect, useSyncExternalStore };
  return { ...actual, ...shim, default: { ...actual, ...shim } };
}

export function renderHook<R>(hook: () => R) {
  let current: R;
  let body = hook;
  const instance: Instance = {
    slots: [],
    index: 0,
    pendingEffects: new Map(),
    busy: false,
    dirty: false,
    mounted: true,
    render: () => {
      instance.dirty = true;
      if (instance.busy || !instance.mounted) return;
      instance.busy = true;
      let passes = 0;
      while (instance.dirty) {
        if (++passes > MAX_PASSES) throw new Error('hookHarness: render loop');
        instance.dirty = false;
        instance.index = 0;
        active = instance;
        current = body();
        if (instance.dirty) continue;
        const effects = [...instance.pendingEffects];
        instance.pendingEffects.clear();
        for (const [i, effect] of effects) {
          const slot = instance.slots[i] as EffectSlot;
          if (typeof slot.cleanup === 'function') slot.cleanup();
          slot.cleanup = effect();
        }
      }
      instance.busy = false;
    },
  };
  instance.render();

  return {
    get current() {
      return current;
    },
    rerender(next: () => R = body) {
      body = next;
      instance.render();
    },
    unmount() {
      instance.mounted = false;
      for (const slot of instance.slots) {
        const cleanup = (slot as EffectSlot | undefined)?.cleanup;
        if (typeof cleanup === 'function') cleanup();
      }
    },
  };
}

// localStorage em memoria + window com eventos, para o ambiente node.
export function createBrowserStubs() {
  const data = new Map<string, string>();
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, String(value)),
    removeItem: (key: string) => void data.delete(key),
    clear: () => data.clear(),
  };
  const window = new EventTarget();
  // Escrita feita "noutra tab": muda o storage e dispara o evento storage.
  const writeFromOtherTab = (key: string, value: string | null) => {
    if (value === null) data.delete(key);
    else data.set(key, value);
    window.dispatchEvent(Object.assign(new Event('storage'), { key }));
  };
  return { data, storage, window, writeFromOtherTab };
}
