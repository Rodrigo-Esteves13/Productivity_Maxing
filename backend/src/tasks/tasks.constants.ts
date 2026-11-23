// Teto de ids por pedido nas operacoes em massa de tasks (estado, esforco,
// reagendar, apagar). Generoso para uma selecao manual, pequeno o bastante
// para um so pedido nao martelar a BD com um IN (...) sem limite. O frontend
// tem o mesmo valor em frontend/src/api/userService.ts (BULK_TASK_BATCH_SIZE).
export const TASK_BULK_MAX = 200;

// Pedidos por minuto ao import Excel/CSV: ate 500 linhas por pedido, o
// endpoint mais caro do controller.
export const TASK_IMPORT_PER_MINUTE = 5;
