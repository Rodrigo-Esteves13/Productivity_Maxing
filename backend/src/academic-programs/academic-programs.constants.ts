// Limites de negocio dos programas e periodos (por utilizador / programa).
export const MAX_PROGRAMS_PER_USER = 20;
export const MAX_PERIODS_PER_PROGRAM = 30;

// Teto de `order` no seletor de programas (cabe sempre num Int do Postgres).
export const MAX_PROGRAM_ORDER = 10000;
