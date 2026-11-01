// Contrato partilhado do resumo de risco (N49). Formas fixas: backend e
// frontend dependem delas.
//
// Rota (JWT, tudo filtrado por userId, mesmo throttle de GET /course-risk):
//   GET /course-risk/overview?absenceLimitPct=&periodId=  -> CourseRiskOverview
//   (literal: declarar ANTES de qualquer rota com parametro; hoje so ha GET /)
//
// Ao contrario de GET /course-risk, o overview devolve TODAS as cadeiras com
// pelo menos uma task ou componente no ambito (periodId, ou todos os periodos
// nao arquivados), mesmo as sem dados suficientes. Assim o widget e a pagina
// podem sempre mostrar um resumo.

import type { CourseRisk } from '../approval-rules/approval-rules.types';

/** assessed = ha veredicto (risk preenchido); not_enough_data = falta peso avaliado. */
export type CourseRiskOverviewStatus = 'assessed' | 'not_enough_data';

export type CourseRiskConfidence = 'low' | 'medium' | 'high';

export interface CourseRiskOverviewRow {
  areaId: string;
  areaName: string;
  colorHex: string;
  status: CourseRiskOverviewStatus;
  /** null quando not_enough_data. */
  risk: CourseRisk | null;
  /**
   * Estimativa heuristica, nao uma previsao estatistica: 100 - risk.score
   * (o score inclui o risco residual do peso por avaliar),
   * arredondada a inteiro em [0, 100]. null quando not_enough_data.
   */
  passChancePct: number | null;
  /** 100 - passChancePct. null quando not_enough_data. */
  failChancePct: number | null;
  /**
   * Quanta evidencia sustenta a estimativa, pelo peso ja avaliado: low <
   * CONFIDENCE_MEDIUM_FROM_PCT, medium < CONFIDENCE_HIGH_FROM_PCT, senao high.
   * Com peso restante > 0 a chance fica limitada a [1, 99] (nunca certeza).
   * null quando not_enough_data.
   */
  confidence: CourseRiskConfidence | null;
  /** Peso ja avaliado em %, 0 se o motor nao devolveu nada. */
  gradedWeightPct: number;
}

export interface CourseRiskSummary {
  totalCourses: number;
  assessedCourses: number;
  /** level high ou extreme. */
  highRiskCourses: number;
  mediumRiskCourses: number;
  lowRiskCourses: number;
  /** Media das passChancePct das cadeiras assessed ponderada por gradedWeightPct, null se nenhuma. */
  avgPassChancePct: number | null;
  /** Cadeira assessed com menor passChancePct (empate: maior score), null se nenhuma. */
  worst: { areaId: string; areaName: string; passChancePct: number } | null;
  /** MIN_GRADED_WEIGHT_PCT, para a UI nao o repetir. */
  minGradedWeightPct: number;
}

export interface CourseRiskOverview {
  /** assessed primeiro por score desc, depois not_enough_data por nome. */
  courses: CourseRiskOverviewRow[];
  summary: CourseRiskSummary;
}
