import { isTypingInFormField } from './isTypingInFormField';

// So dialogos modais bloqueiam atalhos (o Modal partilhado, a paleta e o
// ConfirmDialog usam aria-modal="true"); avisos inline com role="alertdialog"
// sem aria-modal nao.
export const MODAL_DIALOG_SELECTOR =
  '[role="dialog"][aria-modal="true"], [role="alertdialog"][aria-modal="true"]';

// Ecras com o seu proprio teclado (quiz, revisao de flashcards): a raiz leva
// este atributo e os atalhos da paleta ficam desligados enquanto existir.
export const SHORTCUTS_OFF_ATTR = 'data-shortcuts-off';
export const SHORTCUTS_OFF_SELECTOR = `[${SHORTCUTS_OFF_ATTR}]`;
export const SHORTCUTS_OFF_PROPS = { [SHORTCUTS_OFF_ATTR]: '' } as const;

// O dialogo de detalhe da Tasks e o unico modal onde n/c/e/Delete fazem sentido.
export const TASK_SHORTCUTS_SCOPE_ATTR = 'data-task-shortcuts-scope';
export const TASK_SHORTCUTS_SCOPE_SELECTOR = `[${TASK_SHORTCUTS_SCOPE_ATTR}]`;
export const TASK_SHORTCUTS_SCOPE_PROPS = { [TASK_SHORTCUTS_SCOPE_ATTR]: '' } as const;

// keyCode 229 = tecla processada por um IME (alguns browsers nao marcam isComposing).
const IME_KEY_CODE = 229;

export interface ShortcutKeyEvent {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  repeat: boolean;
  isComposing: boolean;
  keyCode: number;
  defaultPrevented: boolean;
  target: unknown;
}

interface DialogRoot {
  querySelector: (selector: string) => unknown;
  querySelectorAll: (selector: string) => ArrayLike<{ querySelector: (selector: string) => unknown }>;
}

// Com allowedScope, so conta como bloqueante um modal aberto que NAO contenha
// esse marcador (ex: a ajuda por cima do detalhe de uma task).
export function hasBlockingModalOpen(root: DialogRoot, allowedScope?: string): boolean {
  const dialogs = Array.from(root.querySelectorAll(MODAL_DIALOG_SELECTOR));
  if (!allowedScope) return dialogs.length > 0;
  return dialogs.some((dialog) => !dialog.querySelector(allowedScope));
}

export function hasShortcutsOffZone(root: DialogRoot): boolean {
  return root.querySelector(SHORTCUTS_OFF_SELECTOR) !== null;
}

export function isImeEvent(e: Pick<ShortcutKeyEvent, 'isComposing' | 'keyCode'>): boolean {
  return e.isComposing || e.keyCode === IME_KEY_CODE;
}

// Guardas comuns aos atalhos de uma tecla: modificadores, repeticao, IME,
// evento ja tratado, a escrever num campo, modal aberto.
export function shouldIgnoreShortcut(e: ShortcutKeyEvent, root: DialogRoot, allowedDialogScope?: string): boolean {
  if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return true;
  if (isImeEvent(e) || e.defaultPrevented) return true;
  if (isTypingInFormField(e.target)) return true;
  return hasBlockingModalOpen(root, allowedDialogScope);
}
