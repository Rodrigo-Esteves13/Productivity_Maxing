import { XIcon } from './Icons';
import IconButton from './IconButton';
import type { ToastAction, ToastKind } from '../../context/feedback-context';
import { useI18n } from '../../i18n/useI18n';

export interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
  action?: ToastAction;
  // A animar para fora; sai da lista no fim da animacao.
  leaving?: boolean;
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
  const { t } = useI18n();
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[80] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role={toast.kind === 'error' ? 'alert' : 'status'}
          data-state={toast.leaving ? 'closed' : 'open'}
          className={`motion-toast pointer-events-auto flex items-start gap-3 rounded-lg border p-3 text-sm shadow-xl ${TONE_CLASS[toast.kind]}`}
        >
          <span className="flex-1">{toast.message}</span>
          {toast.action && (
            <button
              type="button"
              onClick={() => {
                toast.action?.onAction();
                onDismiss(toast.id);
              }}
              className="press shrink-0 rounded-md px-2 py-0.5 font-semibold text-violet-300 hover:bg-violet-900/40 hover:text-white"
            >
              {toast.action.label}
            </button>
          )}
          <IconButton
            label={t('common.dismissMessage')}
            onClick={() => onDismiss(toast.id)}
            className="-my-1.5 -mr-1.5 shrink-0 text-neutral-400"
          >
            <XIcon className="h-4 w-4" />
          </IconButton>
        </div>
      ))}
    </div>
  );
}
