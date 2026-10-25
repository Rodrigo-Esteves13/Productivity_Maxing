import { createContext } from 'react';
import type { GradeComponent } from '../types/models';

export interface PlanModeContextValue {
  isPlanMode: boolean;
  // Preenche os componentes que faltam (modo plano); identidade fora dele.
  planComponents: (components: GradeComponent[]) => GradeComponent[];
}

const identity = (components: GradeComponent[]) => components;

// Fora do Dashboard o modo plano nunca esta ligado: os hooks que o leem
// (usePeriodGradeComponents, medias do servidor) devolvem os dados reais.
export const PlanModeContext = createContext<PlanModeContextValue>({
  isPlanMode: false,
  planComponents: identity,
});
