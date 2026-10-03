export type ScheduleEventKind =
  'class' | 'work' | 'travel' | 'study' | 'study_overtime';

// Um evento que DEVIA existir no Google Calendar, calculado a partir do
// horário, dos turnos e do plano de estudo.
export interface DesiredEvent {
  // Identidade estável entre syncs (nunca o id da Google): é o que permite
  // saber se um evento já foi criado por nós, e atualizá-lo em vez de o
  // duplicar.
  sourceKey: string;
  kind: ScheduleEventKind;
  date: string; // YYYY-MM-DD, hora de Lisboa
  startMinutes: number;
  endMinutes: number;
  title: string;
  description: string | null;
  location: string | null;
  contentHash: string;
}

// Linha de CalendarSyncedEvent, já com a data como chave de dia.
export interface ExistingSyncedEvent {
  id: string;
  sourceKey: string;
  googleEventId: string;
  contentHash: string;
  date: string;
  startMinutes: number;
  endMinutes: number;
  title: string;
}

export interface SyncDiff {
  toCreate: DesiredEvent[];
  toUpdate: { desired: DesiredEvent; existing: ExistingSyncedEvent }[];
  toDelete: ExistingSyncedEvent[];
  unchangedCount: number;
}

export type SyncAction = 'create' | 'update' | 'remove';

// Uma linha do modal de confirmação: o que vai acontecer a que evento.
export interface SyncPreviewItem {
  action: SyncAction;
  title: string;
  date: string; // YYYY-MM-DD
  startMinutes: number;
  endMinutes: number;
}

export interface SyncPreview {
  create: number;
  update: number;
  remove: number;
  unchanged: number;
  // false quando o nº de alterações excede o limite por sync.
  withinLimit: boolean;
  days: number;
  // Primeiros MAX_PREVIEW_ITEMS eventos afetados, por data; o resto só
  // aparece em `hiddenCount` (o modal não precisa de 200 linhas).
  items: SyncPreviewItem[];
  hiddenCount: number;
}

export interface SyncResult {
  created: number;
  updated: number;
  deleted: number;
  unchanged: number;
  failed: number;
}
