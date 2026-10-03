import { Children, Suspense, useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { useColumnCount } from '../../hooks/useColumnCount';
import { layoutTwoColumns, resetToFlow } from '../../lib/masonryLayout';

interface MasonryGridProps {
  children: ReactNode;
  className?: string;
}

export default function MasonryGrid({ children, className = '' }: MasonryGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef(0);
  const columnCount = useColumnCount();
  const items = Children.toArray(children);

  const layout = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    if (columnCount === 2) layoutTwoColumns(container);
    else resetToFlow(container);
  }, [columnCount]);

  // Síncrono antes do paint: sem um frame com os cartões todos empilhados.
  useLayoutEffect(() => {
    layout();
  }, [layout, items.length]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // rAF agrupa várias notificações num único cálculo por frame.
    const schedule = () => {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = requestAnimationFrame(layout);
    };

    const resizeObserver = new ResizeObserver(schedule);
    resizeObserver.observe(container);
    for (const item of Array.from(container.children)) {
      resizeObserver.observe(item);
      if (item.firstElementChild) resizeObserver.observe(item.firstElementChild);
    }

    // Cartões que carregam dados, aparecem ou desaparecem mexem no DOM
    // dentro do wrapper sem mudar o tamanho dele (porque o último está
    // esticado): o MutationObserver apanha esses casos.
    const mutationObserver = new MutationObserver(schedule);
    mutationObserver.observe(container, { childList: true, subtree: true });

    return () => {
      cancelAnimationFrame(frameRef.current);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [layout, items.length]);

  return (
    <div ref={containerRef} className={`flex flex-col gap-4 ${className}`}>
      {items.map((item, index) => (
        // [&>*]:flex-1 faz o cartão preencher o wrapper quando este é
        // esticado; [&>*]:mb-0 anula margens próprias de cada cartão (já
        // há o gap). empty:hidden esconde o wrapper de um cartão que
        // renderiza null, para não deixar buraco nem gap.
        <div
          key={index}
          className="flex flex-col empty:hidden [&>*]:flex-1 [&>*]:mb-0"
        >
          <Suspense fallback={null}>{item}</Suspense>
        </div>
      ))}
    </div>
  );
}
