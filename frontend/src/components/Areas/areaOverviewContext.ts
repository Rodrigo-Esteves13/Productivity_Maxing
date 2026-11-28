import { createContext, useContext } from 'react';
import type { AreaOverviewItem } from '../../lib/areaOverview';

// Resumo por cadeira para os cartoes da grelha, sem passar por cada nivel
// (pagina, seccao, grelha, cartao). Sem provider o cartao fica so com o basico.
export interface AreaOverviewContextValue {
  byAreaId: ReadonlyMap<string, AreaOverviewItem>;
  isLoading: boolean;
  failed: boolean;
  // Maximo da escala de notas do programa ativo; null = sem escala unica (vista de todos).
  gradeMax: number | null;
}

export const AreaOverviewContext = createContext<AreaOverviewContextValue>({
  byAreaId: new Map(),
  isLoading: false,
  failed: false,
  gradeMax: null,
});

export const useAreaOverviewContext = (): AreaOverviewContextValue => useContext(AreaOverviewContext);
