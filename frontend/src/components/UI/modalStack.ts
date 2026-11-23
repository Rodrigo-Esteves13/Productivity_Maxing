import { useEffect, useRef } from 'react';

// Pilha global de camadas modais (Modal e ConfirmDialog). So a do topo
// trata o Escape, para que cancelar uma confirmacao nao feche tambem o
// modal que esta por baixo.
const stack: symbol[] = [];

export function pushLayer(id: symbol): void {
  stack.push(id);
}

export function removeLayer(id: symbol): void {
  const i = stack.lastIndexOf(id);
  if (i >= 0) stack.splice(i, 1);
}

export function isTopLayer(id: symbol): boolean {
  return stack.length > 0 && stack[stack.length - 1] === id;
}

// Regista a camada enquanto `active` e chama `onEscape` so quando e a do topo.
export function useEscapeLayer(active: boolean, onEscape: () => void): void {
  const handlerRef = useRef(onEscape);
  useEffect(() => {
    handlerRef.current = onEscape;
  });

  useEffect(() => {
    if (!active) return;
    const id = Symbol('layer');
    pushLayer(id);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !isTopLayer(id)) return;
      handlerRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      removeLayer(id);
    };
  }, [active]);
}
