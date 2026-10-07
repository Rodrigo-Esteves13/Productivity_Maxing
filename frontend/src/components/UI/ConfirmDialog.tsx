import { useEffect, useRef } from 'react';
import Button from './Button';

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  tone: 'default' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
}

// Dialogo de confirmacao centrado. Foco inicial em "Cancel" quando a acao
// e destrutiva (Enter nao apaga por engano) e em "Confirm" nos restantes.
export default function ConfirmDialog({
  title,
  message,
  confirmLabel,
  cancelLabel,
  tone,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const initialFocusRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKey);
    const target = initialFocusRef.current?.querySelector<HTMLButtonElement>(
      tone === 'danger' ? '[data-role="cancel"]' : '[data-role="confirm"]',
    );
    target?.focus();
    return () => window.removeEventListener('keydown', handleKey);
  }, [onCancel, tone]);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
        className="w-full max-w-sm rounded-xl border border-neutral-800 bg-neutral-900 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-dialog-title" className="text-lg font-bold text-white">
          {title}
        </h2>
        <p id="confirm-dialog-message" className="mt-2 text-sm text-neutral-300 whitespace-pre-line">
          {message}
        </p>
        <div ref={initialFocusRef} className="mt-5 flex justify-end gap-3">
          <Button type="button" variant="secondary" data-role="cancel" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={tone === 'danger' ? 'danger' : 'primary'}
            data-role="confirm"
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
