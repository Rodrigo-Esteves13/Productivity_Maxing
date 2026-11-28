import { createContext } from 'react';
import type { AcademicTaskTypeOption, Area, Task } from '../types/models';

export interface DashboardData {
  // Tasks academicas do periodo (no modo plano, com as notas planeadas).
  academicTasks: Task[];
  // Todas as tasks do periodo (qualquer tipo), para o cartao de equilibrio.
  allTasks: Task[];
  // So as Areas com tasks academicas.
  academicAreas: Area[];
  academicTaskTypes: AcademicTaskTypeOption[];
  // Escala do programa ativo; '' sem programa (os cartoes que a usam nao
  // sao desenhados nesse caso).
  gradeScale: string;
}

export const DashboardDataContext = createContext<DashboardData | null>(null);
