import { useState } from 'react';
import { getApiMessage } from '../lib/httpError';

export interface PendingConfirm {
  title: string;
  message: string;
  confirmLabel: string;
  tone: 'default' | 'danger';
  run: () => Promise<void>;
}

// Uma acao a espera de confirmacao (ConfirmDialog): pedir, cancelar, confirmar.
// Ao contrario de useConfirmDelete, o mesmo dialogo serve varias acoes e
// mostra o erro do backend sem fechar.
export function useConfirmAction(fallbackError: string) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    if (!pending) return;
    setIsBusy(true);
    setError(null);
    try {
      await pending.run();
      setPending(null);
    } catch (err) {
      setError(getApiMessage(err, fallbackError));
    } finally {
      setIsBusy(false);
    }
  };

  return {
    pending,
    isBusy,
    error,
    request: (next: PendingConfirm) => {
      setError(null);
      setPending(next);
    },
    cancel: () => setPending(null),
    confirm,
  };
}
