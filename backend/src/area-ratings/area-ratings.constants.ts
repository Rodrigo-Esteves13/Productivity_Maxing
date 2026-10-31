// Escala das avaliacoes pessoais (docente e cadeira).
export const RATING_MIN = 1;
export const RATING_MAX = 5;

// Quadrantes: gostar = >= 4, nao gostar = <= 2 (3 e neutro e fica de fora).
export const LIKED_MIN_RATING = 4;
export const NOT_LIKED_MAX_RATING = 2;

// Cadeiras com os dois valores precisas para a UI mostrar uma correlacao.
export const RATING_STATS_MIN_SAMPLE = 5;

// Abaixo disto nem ha coeficiente (com 1 ponto nao existe ordem).
export const MIN_PAIRS_FOR_COEFFICIENT = 2;

// Tolerancia de ponto flutuante: [0.7, 0.7, 0.7] tem media 0.6999999999999998,
// por isso "acima da media" e "empate" comparam com esta folga, nunca com ===.
export const EPSILON = 1e-9;

// Casas decimais de r e das medias devolvidas.
export const RATING_STATS_DECIMALS = 2;

// Escritas (PUT/DELETE) por minuto e pedidos de estatistica por minuto
// (a estatistica agrega varias tabelas, como o course-risk).
export const AREA_RATING_WRITES_PER_MINUTE = 60;
export const AREA_RATING_STATS_REQUESTS_PER_MINUTE = 30;
