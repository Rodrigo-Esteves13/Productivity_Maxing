import type { PersonalNote } from '../types/models';

// Espelha MAX_PERSONAL_NOTES_PER_USER do backend (personal-notes.constants.ts).
export const PERSONAL_NOTES_MAX = 500;
// A partir desta fracao do limite a pagina mostra o contador "N de MAX".
export const PERSONAL_NOTES_NEAR_LIMIT_RATIO = 0.8;

export type NoteFilter = 'all' | 'reminder' | 'done' | 'pinned';

export const NOTE_FILTERS: readonly NoteFilter[] = ['all', 'reminder', 'done', 'pinned'];

const NOTE_PREDICATES: Record<NoteFilter, (note: PersonalNote) => boolean> = {
  all: () => true,
  // "Com lembrete": ainda por fazer e com hora marcada.
  reminder: (note) => note.remindAt !== null && note.doneAt === null,
  done: (note) => note.doneAt !== null,
  pinned: (note) => note.pinned,
};

/** Notas que cumprem o filtro de estado; a ordem original mantem-se. */
export function filterNotesByState(notes: readonly PersonalNote[], filter: NoteFilter): PersonalNote[] {
  return notes.filter(NOTE_PREDICATES[filter]);
}

/** true quando ja se usou uma fracao grande do limite de notas. */
export function isNearNoteLimit(
  count: number,
  max: number = PERSONAL_NOTES_MAX,
  ratio: number = PERSONAL_NOTES_NEAR_LIMIT_RATIO,
): boolean {
  return count >= Math.floor(max * ratio);
}

/** true quando ja nao cabe nenhuma nota nova. */
export function isNoteLimitReached(count: number, max: number = PERSONAL_NOTES_MAX): boolean {
  return count >= max;
}

export interface NotesExportLabels {
  done: string;
  pinned: string;
  // Texto de uma linha para o lembrete ("Lembrete: 12/05 09:00").
  reminder: (iso: string) => string;
}

/** Texto simples com todas as notas, para descarregar em .txt. */
export function notesToText(notes: readonly PersonalNote[], labels: NotesExportLabels): string {
  return notes
    .map((note) => {
      const flags = [note.pinned ? labels.pinned : '', note.doneAt ? labels.done : ''].filter(Boolean);
      const heading = flags.length > 0 ? `${note.title} [${flags.join(', ')}]` : note.title;
      const lines = [heading];
      if (note.remindAt) lines.push(labels.reminder(note.remindAt));
      if (note.body) lines.push('', note.body);
      return lines.join('\n');
    })
    .join('\n\n----------\n\n');
}

/** true quando o valor de um datetime-local ("YYYY-MM-DDTHH:mm") ja passou. */
export function isPastLocalInput(value: string, now: number = Date.now()): boolean {
  if (!value) return false;
  const at = new Date(value).getTime();
  return Number.isFinite(at) && at <= now;
}
