export const MAX_PACK_ITEMS = 50;
export const MAX_PACK_NAME_LENGTH = 80;
// Igual ao limite do titulo de uma task (CreateTaskDto).
export const MAX_PACK_ITEM_TITLE_LENGTH = 200;
export const MAX_PACKS_PER_USER = 20;
// Pedidos de atualizacao pendentes devolvidos de uma vez (cada task tem no
// maximo um, por isso isto e "ate N tasks importadas com alteracoes").
export const PACK_UPDATES_PAGE_SIZE = 100;

// Limites de pedidos por minuto (por rota).
export const PACK_WRITES_PER_MINUTE = 10;
export const PACK_ITEM_WRITES_PER_MINUTE = 30;
export const PACK_UPDATE_DECISIONS_PER_MINUTE = 30;
export const PACK_CODE_PREVIEW_PER_MINUTE = 30;
export const PACK_CODE_IMPORT_PER_MINUTE = 10;
export const PACK_PUBLISH_PER_MINUTE = 10;
