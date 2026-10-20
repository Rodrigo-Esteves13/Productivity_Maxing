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

    const resizeObserver = new ResizeObserver(() => schedule());

    // Observa cada wrapper e o cartão lá dentro. Os cartões são lazy: no
    // primeiro render o wrapper ainda está vazio (Suspense), por isso o
    // cartão só existe mais tarde e tem de ser observado nessa altura. Sem
    // isto, o último cartão de cada coluna (com altura fixa) não via o
    // próprio conteúdo crescer e ficava cortado. observe() repetido no
    // mesmo elemento não faz nada.
    const observeItems = () => {
      for (const item of Array.from(container.children)) {
        resizeObserver.observe(item);
        if (item.firstElementChild) resizeObserver.observe(item.firstElementChild);
      }
    };

    // rAF agrupa várias notificações num único cálculo por frame.
    const schedule = () => {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = requestAnimationFrame(() => {
        observeItems();
        layout();
      });
    };

    resizeObserver.observe(container);
    observeItems();

    // Cartões que carregam dados, aparecem ou desaparecem mexem no DOM
    // dentro do wrapper sem mudar o tamanho dele (porque o último está
    // esticado): o MutationObserver apanha esses casos. characterData apanha
    // texto que muda no mesmo nó (trocar de língua).
    const mutationObserver = new MutationObserver(schedule);
    mutationObserver.observe(container, { childList: true, subtree: true, characterData: true });

    // Fontes do sistema (CJK sobretudo) podem chegar depois do primeiro
    // desenho e mudar a altura do texto sem mexer no DOM.
    // (jsdom nos testes nao tem document.fonts.)
    const fonts: FontFaceSet | undefined = document.fonts;
    fonts?.addEventListener('loadingdone', schedule);

    return () => {
      cancelAnimationFrame(frameRef.current);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      fonts?.removeEventListener('loadingdone', schedule);
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
