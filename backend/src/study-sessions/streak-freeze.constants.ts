// Dias de descanso da streak de estudo (StreakFreeze) pedidos pelo user.

// Maximo de dias de descanso por semana ISO (segunda a domingo).
export const FREEZE_MAX_PER_WEEK = 1;

// So se pode pedir para hoje ou para ontem (0 = hoje, 1 = ontem).
export const FREEZE_MAX_DAYS_BACK = 1;

// GET /streak-freezes devolve os dias de descanso desta janela (dias).
export const FREEZE_LIST_WINDOW_DAYS = 28;

// Dias de uma semana ISO e offset para a segunda-feira a partir de getUTCDay
// (0 = domingo): (dia + 6) % 7 dias depois da segunda.
export const DAYS_PER_WEEK = 7;
export const ISO_WEEK_MONDAY_SHIFT = 6;

// Limites de pedidos por minuto.
export const STREAK_FREEZE_WRITES_PER_MINUTE = 20;
export const STREAK_FREEZE_READS_PER_MINUTE = 60;
