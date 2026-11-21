// Subconjunto de HTMLElement que interessa aqui (permite testar sem DOM).
export interface TypingTarget {
  tagName?: string;
  type?: string;
  isContentEditable?: boolean;
  getAttribute?: (name: string) => string | null;
  closest?: (selector: string) => unknown;
}

// Inputs que nao recebem texto: uma tecla solta nao e escrita nelas.
const NON_TEXT_INPUT_TYPES = new Set(['checkbox', 'radio', 'range', 'button', 'submit', 'reset', 'image', 'file', 'color']);
const TEXT_ROLE_SELECTOR = '[role="textbox"], [role="combobox"], [role="searchbox"], [contenteditable=""], [contenteditable="true"]';

// True while focus is inside a form field or a contenteditable element -
// single-key shortcuts stay off in that case so typing "new task" in a
// text field doesn't fire 'n'. Checkbox, radio, range and button inputs
// don't take text, so they don't count; widgets with role textbox/combobox
// (custom editors) do.
export function isTypingInFormField(target: unknown): boolean {
  if (typeof target !== 'object' || target === null) return false;
  const el = target as TypingTarget;
  const tag = typeof el.tagName === 'string' ? el.tagName.toUpperCase() : '';
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag === 'INPUT') {
    const type = (el.type ?? 'text').toLowerCase();
    return !NON_TEXT_INPUT_TYPES.has(type);
  }
  if (el.isContentEditable === true) return true;
  return typeof el.closest === 'function' && Boolean(el.closest(TEXT_ROLE_SELECTOR));
}
