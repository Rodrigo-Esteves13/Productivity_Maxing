const GAP_PX = 16;

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
export function resetToFlow(container: HTMLElement): void {
  container.style.position = '';
  container.style.height = '';
  for (const item of Array.from(container.children) as HTMLElement[]) {
    item.style.cssText = '';
  }
}
