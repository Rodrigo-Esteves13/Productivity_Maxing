import { createContext } from 'react';

export type ToastKind = 'success' | 'error' | 'info';

// Botao opcional dentro da mensagem (ex: "Undo"). Clicar corre a acao e fecha a mensagem.
export interface ToastAction {
  label: string;
  onAction: () => void;
}

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  // 'danger' pinta o botao de confirmar a vermelho (apagar, revogar, limpar).
  tone?: 'default' | 'danger';
}

export interface FeedbackContextValue {
  // Mostra uma mensagem curta que desaparece sozinha (substitui alert()).
  notify: (message: string, kind?: ToastKind, action?: ToastAction) => void;
  // Abre um dialogo de confirmacao e resolve true/false (substitui window.confirm()).
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

export const FeedbackContext = createContext<FeedbackContextValue | null>(null);
