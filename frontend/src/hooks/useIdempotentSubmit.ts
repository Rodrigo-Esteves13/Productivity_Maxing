import { useCallback, useRef, useState } from 'react';
import { IdempotentAttempt, type SubmitOutcome } from '../lib/idempotency';

// Envio de um formulario de criacao: bloqueio sincrono (um duplo clique rapido
// nao dispara dois pedidos) e uma Idempotency-Key por tentativa. `isSubmitting`
// serve para desativar o botao e mostrar o spinner.
export function useIdempotentSubmit() {
  const attemptRef = useRef<IdempotentAttempt | null>(null);
  attemptRef.current ??= new IdempotentAttempt();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = useCallback(async (action: (key: string) => Promise<SubmitOutcome>): Promise<boolean> => {
    const attempt = attemptRef.current as IdempotentAttempt;
    if (attempt.inFlight) return false;
    setIsSubmitting(true);
    try {
      return await attempt.run(action);
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  return { submit, isSubmitting };
}
