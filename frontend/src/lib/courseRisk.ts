import type { CourseRisk } from '../types/models';

/** Cadeira sem nenhum risco (pontuacao 0, nivel baixo, sem razoes): nada a mostrar. */
export function hasVisibleRisk(risk: CourseRisk): boolean {
  return risk.score > 0 || risk.level !== 'low' || risk.reasons.length > 0;
}

// Casas decimais maximas dos numeros mostrados nas razoes (o motor ja arredonda).
const REASON_MAX_FRACTION_DIGITS = 2;

/**
 * Formata os params numericos de uma razao com o separador decimal do idioma
 * ativo (pt 17,7 / en 17.7). Textos (label, teacher) ficam como estao.
 */
export function formatReasonParams(
  params: Record<string, string | number>,
  lang: string,
): Record<string, string | number> {
  const formatter = new Intl.NumberFormat(lang, { maximumFractionDigits: REASON_MAX_FRACTION_DIGITS });
  return Object.fromEntries(
    Object.entries(params).map(([key, value]) => [key, typeof value === 'number' ? formatter.format(value) : value]),
  );
}
