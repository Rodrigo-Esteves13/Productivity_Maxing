import { loadPrefs } from '../hooks/useAccessibilityPrefs';

// Evento que o CompletionBurst (montado uma vez no App) ouve para mostrar a
// animacao. Um evento em vez de um Context: quem conclui tasks (hooks de
// varias paginas, o timer global) nao precisa de saber onde a animacao vive.
export const TASK_COMPLETED_EVENT = 'pm:task-completed';
// Vibracao curta (ms). Um so impulso: um padrao mais longo parecia um erro.
const VIBRATION_MS = 35;

export function prefersReducedMotion(): boolean {
  const prefs = loadPrefs();
  if (prefs.reduceMotion) return true;
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

// Chamado depois de uma ou mais tasks passarem a concluidas (com sucesso).
// Respeita o interruptor "Celebrate completed tasks" do Profile; vibra so
// onde o browser suporta (telemoveis Android, na pratica).
export function celebrateCompletion(count = 1): void {
  if (typeof window === 'undefined' || count <= 0) return;
  if (!loadPrefs().celebrate) return;
  try {
    navigator.vibrate?.(VIBRATION_MS);
  } catch {
    // Alguns browsers lancam fora de um gesto do utilizador; nao faz mal.
  }
  window.dispatchEvent(new CustomEvent(TASK_COMPLETED_EVENT, { detail: { count } }));
}
