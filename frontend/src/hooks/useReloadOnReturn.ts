import { createContext, useContext, useEffect, useRef } from 'react';

// true no separador visivel. Fora de um painel mantido montado vale sempre true.
export const TabActiveContext = createContext(true);

// Um separador que fica montado (components/UI/KeepAlivePanels) volta a ler os
// dados quando o utilizador regressa a ele. `reload` tem de ser silencioso (o
// do useLoadOnce e), para o conteudo nao voltar ao esqueleto.
export function useReloadOnReturn(...reloads: (() => void)[]): void {
  const isActive = useContext(TabActiveContext);
  const wasActiveRef = useRef(isActive);
  const reloadsRef = useRef(reloads);
  useEffect(() => {
    reloadsRef.current = reloads;
  });
  useEffect(() => {
    if (isActive && !wasActiveRef.current) for (const reload of reloadsRef.current) reload();
    wasActiveRef.current = isActive;
  }, [isActive]);
}
