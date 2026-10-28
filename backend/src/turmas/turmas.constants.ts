// Limites da Turma. Um sitio so para DTOs, servicos e controllers.
export const TURMA_NAME_MAX_LENGTH = 80;
export const TURMA_DESCRIPTION_MAX_LENGTH = 500;
export const MAX_TURMAS_PER_USER = 20;
export const MAX_MEMBERS_PER_TURMA = 200;
export const MAX_NOTES_PER_TURMA = 500;
export const MAX_FILES_PER_TURMA = 300;
export const MAX_LINKED_AREAS_PER_MEMBER = 20;
export const MAX_PACKS_PER_TURMA = 50;

export const TURMA_NOTE_TITLE_MAX_LENGTH = 200;
export const TURMA_NOTE_MAX_CONTENT_LENGTH = 50_000;
export const ANNOUNCEMENT_TITLE_MAX_LENGTH = 200;
export const ANNOUNCEMENT_BODY_MAX_LENGTH = 5_000;
export const ANNOUNCEMENTS_PAGE_SIZE = 50;
export const LINKED_ENTRIES_PAGE_SIZE = 200;
export const SEARCH_RESULTS_LIMIT = 20;
export const SEARCH_QUERY_MAX_LENGTH = 200;

// Codigo de convite: sem 0/O/1/I/L para ditar em voz alta numa aula.
export const INVITE_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const INVITE_CODE_LENGTH = 8;
export const INVITE_CODE_PATTERN = /^[A-Z0-9]{8}$/;

// Entrar com codigo e o unico endpoint que da para adivinhar: limite baixo.
export const JOIN_PER_MINUTE = 10;
export const TURMA_WRITES_PER_MINUTE = 60;
export const TURMA_NOTE_SAVES_PER_MINUTE = 120;
export const TURMA_UPLOADS_PER_MINUTE = 20;

export const turmaPath = (turmaId: string) => `/classes/${turmaId}`;
export const TURMAS_PATH = '/classes';
// Convites diretos pendentes por pessoa (evita spam de convites).
export const MAX_PENDING_INVITES_PER_USER = 50;
