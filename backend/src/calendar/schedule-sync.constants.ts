// Máximo de criações + atualizações + remoções por sync. Protege a quota
// da Google e o tempo do pedido: um sync normal de 7 dias são ~40-80.
export const MAX_OPERATIONS_PER_SYNC = 200;

// Quantos pedidos à Google correm em paralelo dentro de um sync.
export const GOOGLE_CONCURRENCY = 4;

// Máximo de linhas removidas por pedido em "remove all".
export const MAX_REMOVE_ALL_PER_REQUEST = 500;

// Linhas listadas no modal de confirmação.
export const MAX_PREVIEW_ITEMS = 40;

export const CALENDAR_TIME_ZONE = 'Europe/Lisbon';

// Marca nos eventos criados por nós (extendedProperties.private): permite
// distingui-los dos teus eventos pessoais se alguma vez for preciso.
export const PMAXING_EVENT_MARKER = 'schedule';

// IDs de cor do Google Calendar (1 a 11).
export const COLOR_ID_BY_KIND = {
  class: '9', // blueberry
  work: '6', // tangerine
  travel: '8', // graphite
  study: '3', // grape
  study_overtime: '11', // tomato
} as const;
