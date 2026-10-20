import { useCallback, useRef, useState } from 'react';
import type { MouseEvent, PointerEvent } from 'react';

// Distancia (px) a partir da qual largar o dedo dispara a acao.
export const SWIPE_TRIGGER_PX = 80;
// O cartao nunca anda mais do que isto, por muito que se arraste.
const SWIPE_MAX_PX = 120;
// Movimento minimo antes de decidir se o gesto e horizontal (swipe) ou
// vertical (scroll da pagina, que fica com o browser).
const AXIS_LOCK_PX = 10;

interface SwipeOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
}

interface Gesture {
  pointerId: number;
  startX: number;
  startY: number;
  axis: 'x' | 'y' | null;
}

// Swipe horizontal so com o dedo (pointerType touch): rato e caneta ficam
// como estavam. O elemento precisa de `touch-action: pan-y` (touch-pan-y)
// para o browser continuar a fazer scroll vertical e deixar o horizontal
// para aqui. Um sentido sem acao nao se mexe.
export function useSwipe({ onSwipeLeft, onSwipeRight }: SwipeOptions) {
  const [offset, setOffset] = useState(0);
  const gesture = useRef<Gesture | null>(null);
  // Depois de um swipe o browser ainda pode disparar um click no cartao
  // (que abria o detalhe); este flag engole esse click.
  const justSwiped = useRef(false);

  const onPointerDown = useCallback((e: PointerEvent<HTMLElement>) => {
    if (e.pointerType !== 'touch') return;
    gesture.current = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, axis: null };
    justSwiped.current = false;
  }, []);

  const onPointerMove = useCallback(
    (e: PointerEvent<HTMLElement>) => {
      const current = gesture.current;
      if (!current || current.pointerId !== e.pointerId) return;
      const dx = e.clientX - current.startX;
      const dy = e.clientY - current.startY;
      if (current.axis === null) {
        if (Math.abs(dx) < AXIS_LOCK_PX && Math.abs(dy) < AXIS_LOCK_PX) return;
        current.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
        if (current.axis === 'x') {
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            // Ponteiro ja terminado: o gesto continua sem captura.
          }
        }
      }
      if (current.axis !== 'x') return;
      const allowed = dx > 0 ? Boolean(onSwipeRight) : Boolean(onSwipeLeft);
      setOffset(allowed ? Math.max(-SWIPE_MAX_PX, Math.min(SWIPE_MAX_PX, dx)) : 0);
    },
    [onSwipeLeft, onSwipeRight],
  );

  const onPointerUp = useCallback(
    (e: PointerEvent<HTMLElement>) => {
      const current = gesture.current;
      gesture.current = null;
      setOffset(0);
      if (!current || current.axis !== 'x') return;
      justSwiped.current = true;
      const dx = e.clientX - current.startX;
      if (dx >= SWIPE_TRIGGER_PX) onSwipeRight?.();
      else if (dx <= -SWIPE_TRIGGER_PX) onSwipeLeft?.();
    },
    [onSwipeLeft, onSwipeRight],
  );

  const onPointerCancel = useCallback(() => {
    gesture.current = null;
    setOffset(0);
  }, []);

  const onClickCapture = useCallback((e: MouseEvent<HTMLElement>) => {
    if (!justSwiped.current) return;
    justSwiped.current = false;
    e.preventDefault();
    e.stopPropagation();
  }, []);

  return {
    offset,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onClickCapture },
  };
}
