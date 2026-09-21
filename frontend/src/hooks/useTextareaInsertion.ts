import { useCallback, useRef } from 'react';
import type { RefObject } from 'react';

interface UseTextareaInsertionResult {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  /**
   * Inserts `text` at the current cursor position (replacing the current
   * selection, if any) and moves the cursor to just after the inserted
   * text. Falls back to appending at the end when the textarea isn't
   * focused/mounted yet.
   */
  insertAtCursor: (text: string) => void;
}

// The textarea's value is React-controlled (NotebookEntryEditor owns
// `textContent` in state), so we can't just mutate the DOM node directly -
// the next render would overwrite it. Instead we read the current
// selection from the ref, hand the caller the new full string to put in
// state, and restore the cursor position on the next tick (after React
// has re-rendered the textarea with the new value).
export function useTextareaInsertion(
  value: string,
  onChange: (next: string) => void,
): UseTextareaInsertionResult {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const insertAtCursor = useCallback(
    (text: string) => {
      const el = textareaRef.current;

      if (!el) {
        onChange(value + text);
        return;
      }

      const start = el.selectionStart ?? value.length;
      const end = el.selectionEnd ?? value.length;
      const next = value.slice(0, start) + text + value.slice(end);
      const cursorPos = start + text.length;

      onChange(next);

      // The textarea still shows the pre-update value until React
      // commits the new one; restore focus/selection right after.
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(cursorPos, cursorPos);
      });
    },
    [value, onChange],
  );

  return { textareaRef, insertAtCursor };
}
