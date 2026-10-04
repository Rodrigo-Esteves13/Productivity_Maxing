import { useState } from 'react';

// Fluxo "pedir confirmacao -> apagar" de um modal: abre, cancela ou
// confirma, e fecha sempre no fim (mesmo que o apagar falhe).
export function useConfirmDelete(onDelete: () => Promise<void>) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const confirm = async () => {
    setIsDeleting(true);
    try {
      await onDelete();
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
