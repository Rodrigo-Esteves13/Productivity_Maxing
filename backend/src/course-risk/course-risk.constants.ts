import { DEFAULT_ABSENCE_LIMIT_PCT } from '../schedule/absence-limit.util';

// Limite de faltas: preferencia so do cliente (useAbsenceLimitPref), por isso
// o cliente envia-o como ?absenceLimitPct. Sem ele vale o valor por omissao
// (o mesmo do aviso semanal de faltas).
export const ABSENCE_LIMIT_PCT_MIN = 1;
export const ABSENCE_LIMIT_PCT_MAX = 100;
export const COURSE_RISK_DEFAULT_ABSENCE_LIMIT_PCT = DEFAULT_ABSENCE_LIMIT_PCT;

// Peso minimo (em %) ja avaliado para a cadeira ter veredicto de risco. Com
// menos, uma nota isolada nao diz nada sobre passar ou chumbar (so as regras
// duras, como uma nota abaixo do minimo de componente, furam este minimo).
export const MIN_GRADED_WEIGHT_PCT = 10;

// Confianca da estimativa pelo peso ja avaliado (%): abaixo de MEDIUM_FROM e
// low, abaixo de HIGH_FROM e medium, a partir dai high.
export const CONFIDENCE_MEDIUM_FROM_PCT = 30;
export const CONFIDENCE_HIGH_FROM_PCT = 60;

// Teto de seguranca de tasks lidas por pedido (uma conta normal tem
// centenas, este teto so protege contra contas gigantes).
export const MAX_TASKS_SCANNED = 5000;

// Pedidos por minuto (calculo agrega varias tabelas).
export const COURSE_RISK_REQUESTS_PER_MINUTE = 30;
