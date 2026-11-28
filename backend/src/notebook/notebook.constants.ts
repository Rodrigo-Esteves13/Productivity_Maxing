// Limites por minuto (e por utilizador/IP) das rotas do notebook.
export const NOTEBOOK_INVITES_PER_MINUTE = 10;
export const NOTEBOOK_ACCESS_REMOVALS_PER_MINUTE = 30;
export const NOTEBOOK_INVITE_RESPONSES_PER_MINUTE = 20;
export const NOTEBOOK_SHARE_READS_PER_MINUTE = 30;
export const NOTEBOOK_SHARE_ACCESS_REQUESTS_PER_MINUTE = 10;
export const NOTEBOOK_SHARE_EDITS_PER_MINUTE = 30;
export const NOTEBOOK_GRANT_REQUESTS_PER_MINUTE = 10;
export const NOTEBOOK_GRANT_DECISIONS_PER_MINUTE = 30;
export const NOTEBOOK_GRANT_READS_PER_MINUTE = 60;
// Decidir pedidos de acesso (pode mandar push a quem pediu).
export const NOTEBOOK_ACCESS_DECISIONS_PER_MINUTE = 30;
// A paleta pesquisa a cada tecla (com debounce): limite folgado mas finito.
export const NOTEBOOK_SEARCHES_PER_MINUTE = 60;

// Numero de aula maximo (sanidade; um ano letivo tem bem menos).
export const NOTEBOOK_CLASS_NUMBER_MAX = 9999;
