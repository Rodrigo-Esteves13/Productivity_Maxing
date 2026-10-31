import api from './client';
import type { CourseRisk } from '../types/models';

export interface CourseRiskParams {
  absenceLimitPct?: number;
  // So este periodo (tem de ser do user). Sem ele, todos os nao arquivados.
  periodId?: string;
}

// Ordenado por score desc pelo backend. Ambos os parametros sao opcionais.
export async function getCourseRisk(params: CourseRiskParams = {}, signal?: AbortSignal): Promise<CourseRisk[]> {
  const response = await api.get<CourseRisk[]>('/course-risk', {
    params: { absenceLimitPct: params.absenceLimitPct, periodId: params.periodId },
    signal,
  });
  return response.data;
}
