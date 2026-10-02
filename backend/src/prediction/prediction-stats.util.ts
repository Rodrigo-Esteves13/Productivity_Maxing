// Estatística pura para o preditor de duração: sem Prisma, sem estado.

/** Quantil por interpolação linear (q em [0,1]). Devolve NaN para lista vazia. */
export function quantile(values: number[], q: number): number {
  if (values.length === 0) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * Math.min(1, Math.max(0, q));
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const weight = position - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

// Amostra mínima para julgar outliers: com menos, o IQR não é fiável e
// estar-se-ia a deitar fora dados bons.
const MIN_SAMPLES_FOR_OUTLIER_CHECK = 12;
// Cerca "far out" de Tukey (Q3 + 3*IQR): só apanha valores muito fora do
// normal, como uma sessão de foco que ficou ligada de um dia para o outro,
// e não tasks que simplesmente foram mais longas.
const OUTLIER_IQR_MULTIPLIER = 3;

/**
 * Remove do treino as durações absurdamente altas. Devolve os índices a
 * manter, para o chamador filtrar as suas próprias linhas em paralelo.
 * O limite de baixo não se aplica: uma task curta nunca é "erro de dados".
 */
export function keepIndicesWithoutUpperOutliers(actuals: number[]): number[] {
  const all = actuals.map((_, index) => index);
  if (actuals.length < MIN_SAMPLES_FOR_OUTLIER_CHECK) return all;

  const q1 = quantile(actuals, 0.25);
  const q3 = quantile(actuals, 0.75);
  const fence = q3 + OUTLIER_IQR_MULTIPLIER * (q3 - q1);
  return all.filter((index) => actuals[index] <= fence);
}

export interface RatioInterval {
  // Multiplicadores sobre a previsão pontual: intervalo = [p*low, p*high].
  lowRatio: number;
  highRatio: number;
}

// Sem informação nenhuma, o intervalo colapsa na própria previsão.
export const NEUTRAL_INTERVAL: RatioInterval = { lowRatio: 1, highRatio: 1 };

const INTERVAL_LOW_QUANTILE = 0.1;
const INTERVAL_HIGH_QUANTILE = 0.9;
const MIN_RATIO = 0.3;
const MAX_RATIO = 4;

/**
 * Intervalo de ~80% a partir de quanto o real se desviou do previsto no
 * treino, em rácio (real/previsto) porque as durações são positivas e
 * enviesadas para cima: um erro de 30 min pesa diferente numa task de 40
 * min e numa de 4 h.
 *
 * Os resíduos são calculados no próprio treino, portanto subestimam o erro
 * futuro. Por isso o intervalo alarga com 1 + 1/sqrt(n): pouco com muitas
 * amostras, bastante com poucas.
 */
export function computeRatioInterval(
  actuals: number[],
  predictions: number[],
): RatioInterval {
  const ratios: number[] = [];
  for (let i = 0; i < actuals.length; i++) {
    if (predictions[i] > 0) ratios.push(actuals[i] / predictions[i]);
  }
  if (ratios.length < 2) return NEUTRAL_INTERVAL;

  const widen = 1 + 1 / Math.sqrt(ratios.length);
  const low = Math.min(1, quantile(ratios, INTERVAL_LOW_QUANTILE)) / widen;
  const high = Math.max(1, quantile(ratios, INTERVAL_HIGH_QUANTILE)) * widen;

  return {
    lowRatio: Math.max(MIN_RATIO, low),
    highRatio: Math.min(MAX_RATIO, high),
  };
}
