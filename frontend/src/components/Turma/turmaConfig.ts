// Mesmos limites do backend (turmas.constants.ts). Aqui so para dar feedback
// cedo nos formularios; quem valida a serio e o backend.
export const TURMA_NAME_MAX_LENGTH = 80;
export const TURMA_DESCRIPTION_MAX_LENGTH = 500;
export const TURMA_NOTE_TITLE_MAX_LENGTH = 200;
export const TURMA_NOTE_MAX_CONTENT_LENGTH = 50_000;
export const ANNOUNCEMENT_TITLE_MAX_LENGTH = 200;
export const ANNOUNCEMENT_BODY_MAX_LENGTH = 5_000;
export const INVITE_CODE_LENGTH = 8;

export type TurmaTab = 'announcements' | 'notes' | 'files' | 'subjects' | 'members';

export const TURMA_TABS: TurmaTab[] = ['announcements', 'notes', 'files', 'subjects', 'members'];

export const TURMA_TAB_LABEL_KEY: Record<TurmaTab, string> = {
  announcements: 'turma.tab.announcements',
  notes: 'turma.tab.notes',
  files: 'turma.tab.files',
  subjects: 'turma.tab.subjects',
  members: 'turma.tab.members',
};

export function isTurmaTab(value: string | null): value is TurmaTab {
  return value !== null && (TURMA_TABS as string[]).includes(value);
}

/** Link de convite: abre /turmas com o codigo ja preenchido. */
export function turmaInviteLink(code: string): string {
  return `${window.location.origin}/turmas?code=${encodeURIComponent(code)}`;
}
