// Limites do módulo de turnos de trabalho. Todos servem de proteção
// contra crescimento/CPU sem limite (ver comentários em cada um).

// Máximo de turnos criados num único pedido (um mês inteiro de dias).
export const MAX_SHIFTS_PER_BATCH = 31;

// Máximo de turnos guardados por utilizador (recorrentes + pontuais).
export const MAX_SHIFTS_PER_USER = 500;

// Máximo de locais/compromissos por utilizador.
export const MAX_COMMITMENTS_PER_USER = 30;

// Janela máxima de GET /work-shifts/range: o loop de expansão é
// proporcional a isto, por isso não pode ser controlado livremente
// pelo cliente.
export const MAX_RANGE_DAYS = 62;

export const MAX_BUFFER_MINUTES = 240;
export const MAX_LABEL_LENGTH = 80;

// Modos de "copiar semana": 'one-off' repete os turnos pontuais de uma
// semana noutra semana concreta; 'fixed' transforma-os em turnos semanais
// (que se repetem todas as semanas até serem apagados).
export const COPY_WEEK_MODES = ['one-off', 'fixed'] as const;
export type CopyWeekMode = (typeof COPY_WEEK_MODES)[number];

// Dia da semana (getUTCDay) em que uma semana começa para esta funcionalidade.
export const WEEK_START_DAY = 1;
export const DAYS_PER_WEEK = 7;
