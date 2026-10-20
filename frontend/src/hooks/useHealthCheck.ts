import { useSyncExternalStore } from 'react';
import { rawFetch } from '../api/client';

export type HealthStatus = 'checking' | 'ok' | 'down';

const POLL_INTERVAL_MS = 30000;
const REQUEST_TIMEOUT_MS = 5000;

// Faz ping ao endpoint /health do backend de X em X segundos.
// Nota: usamos rawFetch (não o axios `api` do api/client.ts) porque não
// queremos enviar o token de auth nem despoletar o interceptor de logout
// em caso de 401/erro - ver o comentário junto de rawFetch para a razão de
// isto ainda passar por um helper partilhado em vez de um fetch() solto.
//
// Estado partilhado ao nivel do modulo: cada pagina monta o seu proprio
// Footer, e antes cada um fazia o seu ping ao montar (1-2 pedidos por
// navegacao, cada um com um SELECT 1 na BD). Agora ha um so poll para a app
// toda, um resultado com menos de 30s serve quem montar a seguir, e com o
// separador escondido nao corre.
let status: HealthStatus = 'checking';
let lastCheckAt = 0;
let inFlight: Promise<void> | null = null;
let timer: number | undefined;
const listeners = new Set<() => void>();

function setStatus(next: HealthStatus) {
  if (next === status) return;
  status = next;
  listeners.forEach((listener) => listener());
}

function check(): Promise<void> {
  if (!inFlight) {
    inFlight = rawFetch('/health', { timeoutMs: REQUEST_TIMEOUT_MS })
      .then((response) => setStatus(response.ok ? 'ok' : 'down'))
      .catch(() => setStatus('down'))
      .finally(() => {
        lastCheckAt = Date.now();
        inFlight = null;
      });
  }
  return inFlight;
}

function checkIfStale() {
  if (Date.now() - lastCheckAt >= POLL_INTERVAL_MS) void check();
}

function onVisibilityChange() {
  if (document.visibilityState === 'visible') checkIfStale();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1) {
    checkIfStale();
    timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void check();
    }, POLL_INTERVAL_MS);
    document.addEventListener('visibilitychange', onVisibilityChange);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    }
  };
}

const getSnapshot = () => status;

export default function useHealthCheck(): HealthStatus {
  return useSyncExternalStore(subscribe, getSnapshot);
}
