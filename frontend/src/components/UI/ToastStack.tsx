import { XIcon } from './Icons';
import type { ToastKind } from '../../context/feedback-context';

export interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastStackProps {
  toasts: ToastItem[];
  onDismiss: (id: number) => void;
}

const TONE_CLASS: Record<ToastKind, string> = {
  success: 'border-violet-800 bg-violet-950 text-violet-200',
  error: 'border-red-500 bg-red-950 text-red-200',
  info: 'border-neutral-700 bg-neutral-900 text-neutral-200',
};

// Pilha de mensagens no canto inferior direito. Erros usam role=alert
// (anunciados de imediato), o resto role=status.
export default function ToastStack({ toasts, onDismiss }: ToastStackProps) {
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[80] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role={toast.kind === 'error' ? 'alert' : 'status'}
          className={`pointer-events-auto flex items-start gap-3 rounded-lg border p-3 text-sm shadow-xl ${TONE_CLASS[toast.kind]}`}
        >
          <span className="flex-1">{toast.message}</span>
          <button
            type="button"
            onClick={() => onDismiss(toast.id)}
            aria-label="Dismiss message"
            className="text-neutral-400 hover:text-white"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
