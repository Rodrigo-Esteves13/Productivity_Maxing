// Limites de pedidos por minuto do ScheduleController.
// Import de .ics: ate ~1000 upserts por pedido.
export const SCHEDULE_IMPORT_PER_MINUTE = 5;
// Estimativa de trajeto: cada pedido bate na Google Distance Matrix (paga).
export const SCHEDULE_COMMUTE_PER_MINUTE = 5;
// Criar, editar e apagar uma aula a mao.
export const SCHEDULE_CLASS_WRITES_PER_MINUTE = 30;

// Aulas criadas a mao: o externalUid leva este prefixo para o import de .ics
// nunca as tratar como "antigas" e apagar.
export const MANUAL_CLASS_UID_PREFIX = 'manual-';
export const CLASS_SUBJECT_MAX = 200;
export const CLASS_LOCATION_MAX = 100;
export const CLASS_PROFESSOR_MAX = 150;
export const CLASS_MAX_START_MINUTES = 1439;
export const CLASS_MAX_END_MINUTES = 1440;
