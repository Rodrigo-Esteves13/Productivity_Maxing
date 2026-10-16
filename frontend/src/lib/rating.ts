// Escala de 1 a 5 (foco das sessoes, interesse por cadeira).
export const RATING_MIN = 1;
export const RATING_MAX = 5;
export const RATING_VALUES = Array.from(
  { length: RATING_MAX - RATING_MIN + 1 },
  (_, i) => RATING_MIN + i,
);
