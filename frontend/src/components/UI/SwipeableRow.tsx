import type { ReactNode } from 'react';
import { SWIPE_TRIGGER_PX, useSwipe } from '../../hooks/useSwipe';

interface SwipeableRowProps {
  children: ReactNode;
  // Arrastar para a direita / esquerda (so no telemovel, ver useSwipe).
  onSwipeRight?: () => void;
  onSwipeLeft?: () => void;
  // O que aparece por baixo enquanto se arrasta (icone + texto curto).
  rightHint?: ReactNode;
  leftHint?: ReactNode;
  className?: string;
}

// Envolve um cartao para lhe dar swipe com as acoes reveladas por baixo.
// Sem nenhuma acao comporta-se como uma div normal. As acoes tem de existir
// tambem noutro sitio (botao, menu): o swipe e so um atalho.
export default function SwipeableRow({
  children,
  onSwipeRight,
  onSwipeLeft,
  rightHint,
  leftHint,
  className = '',
}: SwipeableRowProps) {
  const { offset, handlers } = useSwipe({ onSwipeLeft, onSwipeRight });
  const armed = Math.abs(offset) >= SWIPE_TRIGGER_PX;

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {offset !== 0 && (
        <div
          aria-hidden="true"
          className={`absolute inset-0 flex items-center px-4 text-sm font-semibold transition-colors ${
            offset > 0 ? 'justify-start' : 'justify-end'
          } ${armed ? 'bg-violet-700 text-white' : 'bg-violet-950 text-violet-300'}`}
        >
          <span className="flex items-center gap-2">{offset > 0 ? rightHint : leftHint}</span>
        </div>
      )}
      <div
        {...handlers}
        style={offset !== 0 ? { transform: `translateX(${offset}px)` } : undefined}
        className={`relative h-full touch-pan-y ${
          offset === 0 ? 'transition-transform duration-[var(--duration-fast)] ease-smooth-out motion-reduce:transition-none' : 'bg-neutral-950'
        }`}
      >
        {children}
      </div>
    </div>
  );
}
