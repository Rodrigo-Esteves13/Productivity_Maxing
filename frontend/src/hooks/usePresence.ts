import { useEffect, useState } from 'react';

export type PresenceState = 'open' | 'closed';

// Iguais a --duration-quick / --duration-medium em index.css.
export const MODAL_EXIT_MS = 150;
export const TOAST_EXIT_MS = 350;

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return true;
  return (
    document.documentElement.dataset.motion === 'reduced' ||
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  );
}

// Mantem um elemento montado durante a animacao de saida: com `open` a false
// devolve state="closed" (o CSS anima para fora) e so desmonta passados
// `exitMs`. Com Menos movimento desmonta logo.
export function usePresence(open: boolean, exitMs: number): { mounted: boolean; state: PresenceState } {
  const [mounted, setMounted] = useState(open);
  if (open && !mounted) setMounted(true);

  useEffect(() => {
    if (open || !mounted) return;
    const id = window.setTimeout(() => setMounted(false), prefersReducedMotion() ? 0 : exitMs);
    return () => window.clearTimeout(id);
  }, [open, mounted, exitMs]);

  return { mounted, state: open ? 'open' : 'closed' };
}
