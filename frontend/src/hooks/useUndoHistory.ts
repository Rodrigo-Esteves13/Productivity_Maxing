import { useCallback, useEffect, useRef, useState } from 'react';

// Quanto tempo sem mexer ate uma alteracao virar um passo de undo. Assim um
// undo apaga uma "rajada" de escrita, nao uma letra de cada vez.
const COMMIT_DELAY_MS = 600;
// Passos guardados por entrada. Os mais antigos caem.
const HISTORY_LIMIT = 100;

type Snapshot = Record<string, unknown>;

// Igualdade por campo (referencia). Os setters do rascunho repoem as mesmas
// referencias, por isso um undo nao conta como uma alteracao nova.
function sameSnapshot(a: Snapshot, b: Snapshot): boolean {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((k) => a[k] === b[k]);
}

// Historico de undo/redo para um rascunho (objeto memoizado com os campos).
// `apply` repoe um snapshot no rascunho. `resetKey` limpa o historico
// (trocar de entrada nao pode desfazer para a entrada anterior).
export function useUndoHistory<T extends Snapshot>(value: T, apply: (snapshot: T) => void, resetKey: string) {
  const pastRef = useRef<T[]>([]);
  const futureRef = useRef<T[]>([]);
  const committedRef = useRef(value);
  const valueRef = useRef(value);
  valueRef.current = value;
  const applyRef = useRef(apply);
  applyRef.current = apply;
  const [counts, setCounts] = useState({ past: 0, future: 0, pending: false });

  const sync = useCallback((pending: boolean) => {
    setCounts({ past: pastRef.current.length, future: futureRef.current.length, pending });
  }, []);

  const commit = useCallback(() => {
    const current = valueRef.current;
    if (sameSnapshot(current, committedRef.current)) return;
    pastRef.current = [...pastRef.current, committedRef.current].slice(-HISTORY_LIMIT);
    futureRef.current = [];
    committedRef.current = current;
  }, []);

  useEffect(() => {
    pastRef.current = [];
    futureRef.current = [];
    committedRef.current = valueRef.current;
    sync(false);
  }, [resetKey, sync]);

  useEffect(() => {
    if (sameSnapshot(value, committedRef.current)) {
      committedRef.current = value;
      return;
    }
    sync(true);
    const timer = setTimeout(() => {
      commit();
      sync(false);
    }, COMMIT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [value, commit, sync]);

  const undo = useCallback(() => {
    commit();
    const previous = pastRef.current.at(-1);
    if (!previous) return;
    pastRef.current = pastRef.current.slice(0, -1);
    futureRef.current = [...futureRef.current, committedRef.current];
    committedRef.current = previous;
    applyRef.current(previous);
    sync(false);
  }, [commit, sync]);

  const redo = useCallback(() => {
    commit();
    const next = futureRef.current.at(-1);
    if (!next) return;
    futureRef.current = futureRef.current.slice(0, -1);
    pastRef.current = [...pastRef.current, committedRef.current];
    committedRef.current = next;
    applyRef.current(next);
    sync(false);
  }, [commit, sync]);

  return {
    undo,
    redo,
    canUndo: counts.past > 0 || counts.pending,
    canRedo: counts.future > 0 && !counts.pending,
  };
}
