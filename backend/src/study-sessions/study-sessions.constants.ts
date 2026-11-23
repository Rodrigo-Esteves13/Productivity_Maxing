// Limites e janelas das rotas de /study-sessions.

// Pedidos por minuto (valores iguais aos literais que estavam no controller).
// Escritas a mao: sessao manual, editar, apagar.
export const STUDY_SESSION_WRITES_PER_MINUTE = 30;
// Uma sessao ativa faz 1 heartbeat por minuto: 10 ja e folga larga.
export const STUDY_SESSION_HEARTBEATS_PER_MINUTE = 10;
// "Got distracted": um pedido por clique.
export const STUDY_SESSION_DISTRACTIONS_PER_MINUTE = 60;
// Estatisticas agregadas (distracoes, tempo por Area).
export const STUDY_SESSION_STATS_PER_MINUTE = 30;

// GET /study-sessions/history?days=N
export const HISTORY_DEFAULT_DAYS = 14;
export const HISTORY_MAX_DAYS = 90;
export const HISTORY_MAX_ROWS = 300;

// GET /study-sessions/daily-totals?days=N (84 = ~12 semanas do widget).
export const DAILY_TOTALS_DEFAULT_DAYS = 84;
export const DAILY_TOTALS_MAX_DAYS = 365;
