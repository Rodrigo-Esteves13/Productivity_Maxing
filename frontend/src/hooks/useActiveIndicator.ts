import { useLayoutEffect, useRef, useState } from 'react';

export interface IndicatorRect {
  x: number;
  width: number;
}

// Mede o item ativo (data-active="true") dentro do contentor para um
// indicador absoluto deslizar ate ele. O contentor tem de ser `relative`.
// O indicador so aparece depois da primeira medicao, por isso nao anima ao
// carregar a pagina; dai em diante desliza entre itens.
export function useActiveIndicator<T extends HTMLElement>(activeKey: string) {
  const containerRef = useRef<T>(null);
  const [rect, setRect] = useState<IndicatorRect | null>(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const measure = () => {
      const active = container.querySelector<HTMLElement>('[data-active="true"]');
      setRect(active ? { x: active.offsetLeft, width: active.offsetWidth } : null);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, [activeKey]);

  return { containerRef, rect };
}
