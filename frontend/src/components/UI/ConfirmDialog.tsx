import { useEffect, useRef } from 'react';
import Button from './Button';

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  tone: 'default' | 'danger';
  // A acao em curso: desativa os botoes (e o Esc/clique fora nao cancelam).
  isBusy?: boolean;
  error?: string | null;
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
  isBusy = false,
  error = null,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancel = () => {
    if (!isBusy) onCancel();
  };
  const initialFocusRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isBusy) onCancel();
    };
    window.addEventListener('keydown', handleKey);
    const target = initialFocusRef.current?.querySelector<HTMLButtonElement>(
      tone === 'danger' ? '[data-role="cancel"]' : '[data-role="confirm"]',
    );
    target?.focus();
    return () => window.removeEventListener('keydown', handleKey);
  }, [onCancel, tone, isBusy]);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={cancel}
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
        {error && (
          <p role="alert" className="mt-3 text-sm text-red-400">
            {error}
          </p>
        )}
        <div ref={initialFocusRef} className="mt-5 flex justify-end gap-3">
          <Button type="button" variant="secondary" data-role="cancel" disabled={isBusy} onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={tone === 'danger' ? 'danger' : 'primary'}
            data-role="confirm"
            disabled={isBusy}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
