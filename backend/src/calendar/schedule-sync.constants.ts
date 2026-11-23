import { APP_TIME_ZONE } from '../common/time.constants';
// Máximo de criações + atualizações + remoções por sync. Protege a quota
// da Google e o tempo do pedido: um sync normal de 7 dias são ~40-80.
export const MAX_OPERATIONS_PER_SYNC = 200;

// Quantos pedidos à Google correm em paralelo dentro de um sync.
export const GOOGLE_CONCURRENCY = 4;

// Máximo de linhas removidas por pedido em "remove all".
export const MAX_REMOVE_ALL_PER_REQUEST = 500;

// Linhas listadas no modal de confirmação.
export const MAX_PREVIEW_ITEMS = 40;

export const CALENDAR_TIME_ZONE = APP_TIME_ZONE;

// Marca nos eventos criados por nós (extendedProperties.private): permite
// distingui-los dos teus eventos pessoais se alguma vez for preciso.
export const PMAXING_EVENT_MARKER = 'schedule';

// IDs de cor do Google Calendar (1 a 11).
export const COLOR_ID_BY_KIND = {
  class: '9', // blueberry (azul: escola)
  work: '5', // banana (amarelo: trabalho)
  event: '4', // flamingo (rosa: eventos pontuais, nao confundir com trabalho)
  travel: '8', // graphite
  study: '3', // grape
  study_overtime: '11', // tomato
  holiday: '7', // peacock (dia sem trabalho: feriado do local)
} as const;

// Sync/unsync de uma task com o Google Calendar: cada chamada gasta quota da
// API da Google.
export const CALENDAR_TASK_SYNCS_PER_MINUTE = 20;

// Pedidos por minuto dos endpoints de sync de horario e do feed .ics.
export const SCHEDULE_SYNC_PREVIEW_PER_MINUTE = 10;
export const SCHEDULE_SYNC_WRITE_PER_MINUTE = 3;
export const CALENDAR_FEED_ROTATE_PER_MINUTE = 10;
export const CALENDAR_FEED_READ_PER_MINUTE = 30;
