import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import ConfirmDialog from '../components/UI/ConfirmDialog';
import ToastStack, { type ToastItem } from '../components/UI/ToastStack';
import {
  FeedbackContext,
  type ConfirmOptions,
  type FeedbackContextValue,
  type ToastKind,
} from './feedback-context';

const TOAST_DURATION_MS = 6000;
const MAX_TOASTS = 4;
const DEFAULT_CONFIRM_TITLE = 'Are you sure?';
const DEFAULT_CONFIRM_LABEL = 'Confirm';
const DEFAULT_CANCEL_LABEL = 'Cancel';

interface PendingConfirm {
  options: ConfirmOptions;
  resolve: (confirmed: boolean) => void;
}

// Substitui window.alert/window.confirm: mensagens que desaparecem
// sozinhas (notify) e um dialogo de confirmacao baseado em promessa
// (confirm). Montado uma unica vez, na raiz da app.
export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const nextToastId = useRef(1);
  // Guarda o resolve atual para que um segundo confirm() nunca deixe o
  // primeiro promise pendurado para sempre.
  const pendingRef = useRef<PendingConfirm | null>(null);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback(
    (message: string, kind: ToastKind = 'info') => {
      const id = nextToastId.current++;
      setToasts((prev) => [...prev.slice(-(MAX_TOASTS - 1)), { id, kind, message }]);
      window.setTimeout(() => dismiss(id), TOAST_DURATION_MS);
    },
    [dismiss],
  );

  const settle = useCallback((confirmed: boolean) => {
    pendingRef.current?.resolve(confirmed);
    pendingRef.current = null;
    setPending(null);
  }, []);

  const confirm = useCallback((options: ConfirmOptions) => {
    pendingRef.current?.resolve(false);
    return new Promise<boolean>((resolve) => {
      const next = { options, resolve };
      pendingRef.current = next;
      setPending(next);
    });
  }, []);

  const value = useMemo<FeedbackContextValue>(() => ({ notify, confirm }), [notify, confirm]);

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      <ToastStack toasts={toasts} onDismiss={dismiss} />
      {pending && (
        <ConfirmDialog
          title={pending.options.title ?? DEFAULT_CONFIRM_TITLE}
          message={pending.options.message}
          confirmLabel={pending.options.confirmLabel ?? DEFAULT_CONFIRM_LABEL}
          cancelLabel={pending.options.cancelLabel ?? DEFAULT_CANCEL_LABEL}
          tone={pending.options.tone ?? 'default'}
          onConfirm={() => settle(true)}
          onCancel={() => settle(false)}
        />
      )}
    </FeedbackContext.Provider>
  );
}
