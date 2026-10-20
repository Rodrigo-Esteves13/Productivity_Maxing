// Instalacao da PWA ("Adicionar ao ecra principal").
//
// O Chrome/Edge/Android disparam `beforeinstallprompt` uma vez, muitas vezes
// antes de qualquer componente montar. Por isso o evento e apanhado aqui, ao
// arrancar (initInstallPrompt em main.tsx), e guardado ate alguem carregar
// em "Instalar". O Safari (iPhone/iPad) nao tem este evento: ai so da para
// explicar os passos do botao Partilhar.

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export interface InstallPromptState {
  // Ha um pedido de instalacao do browser guardado (Chrome/Edge/Android).
  canPrompt: boolean;
  // A app foi instalada nesta sessao (evento appinstalled).
  installed: boolean;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let state: InstallPromptState = { canPrompt: false, installed: false };
const listeners = new Set<() => void>();

function setState(next: InstallPromptState) {
  state = next;
  for (const listener of listeners) listener();
}

export function initInstallPrompt(): void {
  if (typeof window === 'undefined') return;
  window.addEventListener('beforeinstallprompt', (event) => {
    // Sem isto o Chrome mostra a sua propria mini-barra; queremos o nosso cartao.
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    setState({ ...state, canPrompt: true });
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    setState({ canPrompt: false, installed: true });
  });
}

export function subscribeInstallPrompt(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getInstallPromptState(): InstallPromptState {
  return state;
}

/** Abre o dialogo de instalacao do browser. true se a pessoa aceitou. */
export async function promptInstall(): Promise<boolean> {
  const event = deferredPrompt;
  if (!event) return false;
  // O mesmo evento so pode ser usado uma vez.
  deferredPrompt = null;
  setState({ ...state, canPrompt: false });
  await event.prompt();
  const choice = await event.userChoice;
  return choice.outcome === 'accepted';
}

/** A app ja esta a correr instalada (janela propria, sem barra do browser). */
export function isRunningStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return iosStandalone || window.matchMedia?.('(display-mode: standalone)').matches === true;
}

const IOS_DEVICE = /iphone|ipad|ipod/i;
const IPADOS_PLATFORM = 'MacIntel';

/** iPhone/iPad (o iPadOS apresenta-se como Mac, mas com ecra tatil). */
export function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return IOS_DEVICE.test(navigator.userAgent) || (navigator.platform === IPADOS_PLATFORM && navigator.maxTouchPoints > 1);
}
