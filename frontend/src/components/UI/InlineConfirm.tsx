interface InlineConfirmProps {
  message: string;
  confirmLabel: string;
  isBusy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  className?: string;
}

// Pergunta de confirmacao dentro da propria linha/cartao, para acoes
// destrutivas pequenas onde um modal seria demasiado.
export default function InlineConfirm({
  message,
  confirmLabel,
  isBusy = false,
  onConfirm,
  onCancel,
  className = '',
}: InlineConfirmProps) {
  return (
    <div role="alert" className={`flex flex-wrap items-center gap-2 text-sm ${className}`}>
      <span className="text-neutral-300">{message}</span>
      <button
        type="button"
        disabled={isBusy}
        onClick={onConfirm}
        className="px-3 py-1.5 rounded-lg bg-red-600/80 hover:bg-red-600 text-white disabled:opacity-50"
      >
        {confirmLabel}
      </button>
      <button type="button" onClick={onCancel} className="text-neutral-400 hover:text-white">
        Cancel
      </button>
    </div>
  );
}
