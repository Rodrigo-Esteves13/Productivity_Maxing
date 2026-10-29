import type { ReactNode } from 'react';

interface EmptyStateProps {
  message: string;
  // 'card': caixa propria, para quando a lista vazia e o conteudo da pagina.
  // 'inline': so o texto, para dentro de um cartao que ja tem borda (uma
  // caixa dentro da caixa so ocupava espaco).
  variant?: 'card' | 'inline';
  // O passo seguinte (um link para onde se resolve o vazio), por baixo do texto.
  action?: ReactNode;
}

const VARIANT_CLASS: Record<NonNullable<EmptyStateProps['variant']>, string> = {
  card: 'p-8 text-center bg-neutral-900/50 border border-neutral-800 rounded-xl text-neutral-400',
  inline: 'py-3 text-center text-sm text-neutral-500',
};

export default function EmptyState({ message, variant = 'card', action }: EmptyStateProps) {
  return (
    <div className={VARIANT_CLASS[variant]}>
      <p>{message}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
