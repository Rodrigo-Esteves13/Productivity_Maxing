import { useState, type ReactNode } from 'react';
import { TabActiveContext } from '../../hooks/useReloadOnReturn';
import { addVisitedTab } from '../../lib/visitedTabs';

interface KeepAlivePanelsProps<T extends string> {
  active: T;
  render: (tab: T) => ReactNode;
}

// Paineis de separadores que ficam montados depois da primeira visita (so o
// ativo se ve). Dar uma `key` para esquecer tudo quando o contexto muda.
export default function KeepAlivePanels<T extends string>({ active, render }: KeepAlivePanelsProps<T>) {
  const [visited, setVisited] = useState<readonly T[]>([active]);
  const next = addVisitedTab(visited, active);
  // Ajuste durante o render (padrao do React), sem um efeito a atrasar.
  if (next !== visited) setVisited(next);

  return (
    <>
      {next.map((tab) => (
        <div key={tab} hidden={tab !== active}>
          <TabActiveContext.Provider value={tab === active}>{render(tab)}</TabActiveContext.Provider>
        </div>
      ))}
    </>
  );
}
