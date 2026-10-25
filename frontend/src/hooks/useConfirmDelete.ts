import { useState } from 'react';

// Fluxo "pedir confirmacao -> apagar" de um modal: abre, cancela ou
// confirma, e fecha sempre no fim (mesmo que o apagar falhe). Uma falha
// chama onError (antes a rejeicao escapava e o modal fechava sem aviso).
export function useConfirmDelete(onDelete: () => Promise<void>, onError?: () => void) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const confirm = async () => {
    setIsDeleting(true);
    try {
      await onDelete();
    } catch {
      onError?.();
    } finally {
      setIsDeleting(false);
      setIsConfirming(false);
    }
  };

  return {
    isConfirming,
    isDeleting,
    request: () => setIsConfirming(true),
    cancel: () => setIsConfirming(false),
    confirm,
  };
}
