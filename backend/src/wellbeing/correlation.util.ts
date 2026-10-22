import { MIN_CORRELATION_SAMPLES } from './wellbeing.constants';

// Limites de |r| para a etiqueta mostrada ao utilizador (convencao de Cohen).
const STRENGTH_THRESHOLDS: { min: number; label: CorrelationStrength }[] = [
  { min: 0.5, label: 'strong' },
  { min: 0.3, label: 'moderate' },
  { min: 0.1, label: 'weak' },
  { min: 0, label: 'none' },
];
// Desvio abaixo disto = valores praticamente todos iguais (r indefinido).
const MIN_STD = 1e-9;

export type CorrelationStrength = 'none' | 'weak' | 'moderate' | 'strong';

export type CorrelationResult =
  | { kind: 'not_enough_data'; sampleSize: number }
  | { kind: 'no_variation'; sampleSize: number }
  | {
      kind: 'ok';
      sampleSize: number;
      // Coeficiente de Pearson, -1 a 1, arredondado a 2 casas.
      r: number;
      strength: CorrelationStrength;
    };

function mean(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

// Correlacao de Pearson entre pares (x, y). Diz "dados insuficientes" ou
// "sem variacao" em vez de inventar um numero.
export function pearson(pairs: [number, number][]): CorrelationResult {
  const sampleSize = pairs.length;
  if (sampleSize < MIN_CORRELATION_SAMPLES) {
    return { kind: 'not_enough_data', sampleSize };
  }
  const xs = pairs.map(([x]) => x);
  const ys = pairs.map(([, y]) => y);
  const mx = mean(xs);
  const my = mean(ys);
  let cov = 0;
  let vx = 0;
  let vy = 0;
  for (const [x, y] of pairs) {
    cov += (x - mx) * (y - my);
    vx += (x - mx) ** 2;
    vy += (y - my) ** 2;
  }
  if (Math.sqrt(vx) < MIN_STD || Math.sqrt(vy) < MIN_STD) {
    return { kind: 'no_variation', sampleSize };
  }
  const r = Math.round((cov / Math.sqrt(vx * vy)) * 100) / 100;
  const strength =
    STRENGTH_THRESHOLDS.find((t) => Math.abs(r) >= t.min)?.label ?? 'none';
  return { kind: 'ok', sampleSize, r, strength };
}
