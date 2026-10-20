import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

export type PreloadableComponent<P extends object> = LazyExoticComponent<ComponentType<P>> & {
  // Descarrega (e avalia) o chunk antes de ser preciso: hover num link,
  // tempo livre do browser. Chamar varias vezes faz um so pedido.
  preload: () => Promise<unknown>;
};

// React.lazy com preload(): a pagina ou o componente pesado ja esta pronto
// quando a pessoa clica, em vez de mostrar o esqueleto enquanto o JS chega.
// Se o import falhar (rede), a proxima tentativa volta a pedir o chunk.
export function lazyWithPreload<P extends object>(
  factory: () => Promise<{ default: ComponentType<P> }>,
): PreloadableComponent<P> {
  let pending: Promise<{ default: ComponentType<P> }> | null = null;
  const load = () => {
    pending ??= factory().catch((error: unknown) => {
      pending = null;
      throw error;
    });
    return pending;
  };
  return Object.assign(lazy(load), { preload: load });
}

interface NetworkInformationLike {
  saveData?: boolean;
  effectiveType?: string;
}

// Rede lenta ou "poupar dados" ligado: nada de downloads especulativos.
export function canPrefetch(): boolean {
  const connection = (navigator as Navigator & { connection?: NetworkInformationLike }).connection;
  if (!connection) return true;
  return !connection.saveData && !/(^|-)2g$/.test(connection.effectiveType ?? '');
}

// Corre `task` quando o browser estiver livre (Safari nao tem
// requestIdleCallback: usa um timeout curto). Devolve o cancelamento.
export function whenIdle(task: () => void, timeoutMs = 2000): () => void {
  if ('requestIdleCallback' in window) {
    const id = window.requestIdleCallback(task, { timeout: timeoutMs });
    return () => window.cancelIdleCallback(id);
  }
  const id = setTimeout(task, timeoutMs);
  return () => clearTimeout(id);
}
