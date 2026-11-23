// Limites das rotas de /predictions e janela de historico dos modelos.

// GET /predictions/accuracy le todas as tasks com estimativa: throttle
// proprio (S-17), igual ao das outras estatisticas agregadas.
export const PREDICTION_ACCURACY_PER_MINUTE = 30;

// B-34: o treino do modelo de duracao e o fator de calibracao so olham para
// tasks dos ultimos 12 meses (concluidas nessa janela, ou sem completedAt e
// com data nessa janela). Antes liam o historico todo a cada pedido. Muda a
// amostra de proposito: habitos de estudo de ha anos dizem pouco sobre os de
// hoje, e o custo deixa de crescer com o uso.
export const PREDICTION_HISTORY_WINDOW_DAYS = 365;
