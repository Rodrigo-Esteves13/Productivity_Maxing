/** Maximo de Areas privadas por user (trava abuso/spam de linhas). */
export const MAX_PRIVATE_AREAS_PER_USER = 50;
/** Maximo de propostas pendentes ao mesmo tempo por user. */
export const MAX_PENDING_PROPOSALS_PER_USER = 5;
/** Codigo do 409 ao apagar uma Area que ainda tem dados (ver remove()). */
export const AREA_IN_USE_CODE = 'AREA_IN_USE';

/** Creditos maximos de uma cadeira (ECTS ou equivalente). */
export const MAX_AREA_CREDITS = 100;

/** Valor de `periodId` que desliga a anotacao usedInPeriod. */
export const ALL_PERIODS_QUERY_VALUE = 'all';

// Limites de pedidos por minuto (por rota de escrita).
export const AREA_CREATE_PER_MINUTE = 20;
export const AREA_VISIBILITY_ALL_PER_MINUTE = 20;
export const AREA_VISIBILITY_ONE_PER_MINUTE = 60;
export const AREA_EDIT_PER_MINUTE = 30;
export const AREA_PROPOSAL_PER_MINUTE = 10;
