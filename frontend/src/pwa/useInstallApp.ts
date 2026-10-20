import { useCallback, useState, useSyncExternalStore } from 'react';
import {
  getInstallPromptState,
  isIosDevice,
  isRunningStandalone,
  promptInstall,
  subscribeInstallPrompt,
} from './installPrompt';

// 'prompt' = o browser deixa instalar com um botao; 'ios' = mostrar os
// passos do Safari; null = nada a oferecer (ja instalada ou sem suporte).
export type InstallMode = 'prompt' | 'ios' | null;

const DISMISS_KEY = 'pm-install-dismissed';

function loadDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === 'true';
  } catch {
    return false;
  }
}

function resolveMode(canPrompt: boolean, installed: boolean): InstallMode {
  if (installed || isRunningStandalone()) return null;
  if (canPrompt) return 'prompt';
  if (isIosDevice()) return 'ios';
  return null;
}

export function useInstallApp() {
  const { canPrompt, installed } = useSyncExternalStore(subscribeInstallPrompt, getInstallPromptState);
  const [isDismissed, setIsDismissed] = useState(loadDismissed);

  const dismiss = useCallback(() => {
    setIsDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, 'true');
    } catch {
      // Best-effort: sem storage o cartao volta a aparecer na proxima visita.
    }
  }, []);

  return { mode: resolveMode(canPrompt, installed), isDismissed, dismiss, install: promptInstall };
}
