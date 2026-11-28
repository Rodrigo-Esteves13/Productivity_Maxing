import type { ReactNode } from 'react';
import ActionButton from '../UI/ActionButton';
import { RefreshIcon } from '../UI/Icons';

interface FinanceSubmitButtonProps {
  isSubmitting: boolean;
  /** Desativa tambem sem pedido em curso (ex.: nada mudou). */
  disabled?: boolean;
  children: ReactNode;
}

// Botao de enviar que fica desativado com spinner enquanto o pedido corre.
export default function FinanceSubmitButton({ isSubmitting, disabled = false, children }: FinanceSubmitButtonProps) {
  return (
    <ActionButton type="submit" disabled={isSubmitting || disabled} aria-busy={isSubmitting} className="inline-flex items-center gap-2">
      {isSubmitting && <RefreshIcon className="h-4 w-4 animate-spin motion-reduce:animate-none" />}
      {children}
    </ActionButton>
  );
}
