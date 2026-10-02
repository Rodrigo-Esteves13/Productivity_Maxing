import {
  Children,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';

const GAP_PX = 16;
// Mesmo breakpoint `lg` do Tailwind, que é onde o Dashboard passa a 2 colunas.
const TWO_COLUMN_QUERY = '(min-width: 1024px)';

function useColumnCount(): 1 | 2 {
  const [isWide, setIsWide] = useState(
    () => window.matchMedia(TWO_COLUMN_QUERY).matches,
  );

  useEffect(() => {
    const query = window.matchMedia(TWO_COLUMN_QUERY);
    const onChange = (event: MediaQueryListEvent) => setIsWide(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  return isWide ? 2 : 1;
}

// Posiciona cada item na coluna mais curta e estica o ÚLTIMO item de cada
// coluna até ao fundo do contentor, para as duas colunas acabarem à mesma
// altura. Mexe só em estilos inline (nunca na árvore React), por isso um
// cartão nunca muda de pai nem é remontado: o estado e os dados que cada
// cartão já carregou mantêm-se.
export function layoutTwoColumns(container: HTMLElement): void {
  const items = Array.from(container.children) as HTMLElement[];
  const columnWidth = (container.clientWidth - GAP_PX) / 2;

  container.style.position = 'relative';

  // Primeiro a largura e a altura natural de todos, só depois se mede:
  // a altura de um cartão depende da largura (o texto quebra).
  for (const item of items) {
    item.style.position = 'absolute';
    item.style.width = `${columnWidth}px`;
    item.style.height = '';
  }

  const columnBottoms = [0, 0];
  const lastInColumn: (HTMLElement | null)[] = [null, null];
  const tops = new Map<HTMLElement, number>();

  for (const item of items) {
    const height = item.offsetHeight;
    // Cartões sem dados renderizam vazios (display:none): não ocupam lugar.
    if (height === 0) continue;

    const column = columnBottoms[0] <= columnBottoms[1] ? 0 : 1;
    const top = columnBottoms[column];
    item.style.left = `${column * (columnWidth + GAP_PX)}px`;
    item.style.top = `${top}px`;
    tops.set(item, top);

    columnBottoms[column] = top + height + GAP_PX;
    lastInColumn[column] = item;
  }

  const totalHeight = Math.max(0, Math.max(...columnBottoms) - GAP_PX);
  container.style.height = `${totalHeight}px`;

  for (const item of lastInColumn) {
    if (item) item.style.height = `${totalHeight - (tops.get(item) ?? 0)}px`;
  }
}

// Numa coluna só volta ao fluxo normal do navegador (flex em coluna).
function resetToFlow(container: HTMLElement): void {
  container.style.position = '';
  container.style.height = '';
  for (const item of Array.from(container.children) as HTMLElement[]) {
    item.style.cssText = '';
  }
}

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
