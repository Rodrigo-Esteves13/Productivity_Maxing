import { useEffect, useRef } from 'react';

interface TaskShortcutHandlers {
  // 'n' - always available (opens the create-task modal).
  onCreate: () => void;
  // Only wired while a task's detail modal is open and NOT already in
  // edit mode - see the isDetailOpen/isEditing guards in Tasks.tsx.
  onComplete?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

const TYPING_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

// True while focus is inside a form field or a contenteditable element -
// shortcuts stay off in that case so typing "new task" in a text field
// doesn't fire 'n', or writing a task title that happens to contain 'e'
// doesn't toggle edit mode underneath the input.
function isTypingInFormField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return TYPING_TAGS.has(target.tagName) || target.isContentEditable;
}

// Single-key shortcuts for the Tasks page's most common actions - no
// modifier key (Cmd/Ctrl+K is already taken by the command palette, and a
// bare letter is the fastest thing to reach for while scanning a list).
// Disabled entirely while the create/edit form is open (isFormOpen) - a
// form has its own inputs everywhere, no point risking a stray keystroke.
export function useTaskShortcuts(
  handlers: TaskShortcutHandlers,
  isFormOpen: boolean,
) {
  // `handlers` is a fresh object every render (the caller passes an
  // inline literal) - a ref keeps the listener itself stable across
  // renders while still always calling the latest closures.
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isFormOpen || isTypingInFormField(e.target)) return;

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
  }, [isFormOpen]);
}
