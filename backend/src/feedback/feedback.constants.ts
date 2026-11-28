// Limites de pedidos por minuto (ver perMinute em common/throttle.util.ts).
export const FEEDBACK_CREATE_PER_MINUTE = 5;
export const FEEDBACK_MODERATE_PER_MINUTE = 30;
// Listagem admin paginada (GET /feedback com parametros).
export const FEEDBACK_PAGE_SIZE = 25;
export const FEEDBACK_PAGE_MAX = 100;
export const FEEDBACK_SEARCH_MAX_LENGTH = 100;
export const FEEDBACK_LANGUAGE_MAX_LENGTH = 10;
export const FEEDBACK_STATUS_FILTERS = ['open', 'closed', 'all'] as const;
export type FeedbackStatusFilter = (typeof FEEDBACK_STATUS_FILTERS)[number];
export const SELF_MUTE_MESSAGE = 'You cannot mute your own account.';
