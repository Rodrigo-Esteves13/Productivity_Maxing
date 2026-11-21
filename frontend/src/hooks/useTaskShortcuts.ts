import { useEffect, useRef } from 'react';
import { shouldIgnoreShortcut, TASK_SHORTCUTS_SCOPE_SELECTOR } from '../lib/shortcutGuards';
import { usePaletteShortcutsPref } from './usePaletteShortcutsPref';

interface TaskShortcutHandlers {
  // 'n' - always available (opens the create-task modal).
  onCreate: () => void;
  // Only wired while a task's detail modal is open and NOT already in
  // edit mode - see the isDetailOpen/isEditing guards in Tasks.tsx.
  onComplete?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

// Single-key shortcuts for the Tasks page's most common actions - no
// modifier key (Cmd/Ctrl+K is already taken by the command palette, and a
// bare letter is the fastest thing to reach for while scanning a list).
// Disabled entirely while the create/edit form is open (isFormOpen) - a
// form has its own inputs everywhere, no point risking a stray keystroke.
// Same guards as the palette shortcuts (repeat, IME, typing, modal dialogs):
// the only modal that lets them through is the task detail one (marked with
// TASK_SHORTCUTS_SCOPE), so help, confirm and the palette itself block them.
// Also follows the "keyboard shortcuts" preference (Profile > Accessibility).
export function useTaskShortcuts(
  handlers: TaskShortcutHandlers,
  isFormOpen: boolean,
) {
  const { enabled } = usePaletteShortcutsPref();
  // `handlers` is a fresh object every render (the caller passes an
  // inline literal) - a ref keeps the listener itself stable across
  // renders while still always calling the latest closures. Atualizado num
  // efeito e nao no render: escrever num ref durante o render impede o React
  // Compiler de otimizar o hook.
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    if (!enabled) return;
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (isFormOpen || shouldIgnoreShortcut(e, document, TASK_SHORTCUTS_SCOPE_SELECTOR)) return;

      const current = handlersRef.current;
      switch (e.key.toLowerCase()) {
        case 'n':
          e.preventDefault();
          current.onCreate();
          break;
        case 'c':
          if (current.onComplete) {
            e.preventDefault();
            current.onComplete();
          }
          break;
        case 'e':
          if (current.onEdit) {
            e.preventDefault();
            current.onEdit();
          }
          break;
        case 'delete':
        case 'backspace':
          if (current.onDelete) {
            e.preventDefault();
            current.onDelete();
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFormOpen, enabled]);
}
