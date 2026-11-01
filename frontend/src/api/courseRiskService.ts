import api from './client';
import type { CourseRiskOverview } from '../types/models';

export interface CourseRiskParams {
  absenceLimitPct?: number;
  // So este periodo (tem de ser do user). Sem ele, todos os nao arquivados.
  periodId?: string;
}

// Todas as cadeiras do ambito (tambem as sem dados suficientes) mais o resumo.
// Ambos os parametros sao opcionais.
export async function getCourseRiskOverview(
  params: CourseRiskParams = {},
  signal?: AbortSignal,
): Promise<CourseRiskOverview> {
  const response = await api.get<CourseRiskOverview>('/course-risk/overview', {
    params: { absenceLimitPct: params.absenceLimitPct, periodId: params.periodId },
    signal,
  });
  return response.data;
}
