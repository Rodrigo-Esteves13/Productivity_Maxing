export const FLASHCARD_FRONT_MAX = 300;
export const FLASHCARD_BACK_MAX = 2000;
export const MAX_FLASHCARDS_PER_USER = 2000;
export const FLASHCARD_WRITES_PER_MINUTE = 60;
// Cartoes por pedido de importacao em bloco (POST /flashcards/bulk).
export const FLASHCARD_BULK_MAX = 100;
export const FLASHCARD_LIST_LIMIT = 2000;
// Previsao de revisoes (GET /flashcards/forecast): dias a frente, hoje incluido.
export const FLASHCARD_FORECAST_DAYS = 30;
// Chave de byArea para cartoes sem area.
export const FLASHCARD_FORECAST_NO_AREA = 'none';
// Limites do estado de agenda aceite ao repor um cartao (POST /flashcards/:id/restore).
export const FLASHCARD_EASE_MIN = 1.3;
export const FLASHCARD_EASE_MAX = 10;
export const FLASHCARD_STATE_COUNT_MAX = 100000;
