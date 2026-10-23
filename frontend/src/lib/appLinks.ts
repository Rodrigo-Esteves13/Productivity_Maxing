// Caminhos da app num so sitio (o backend tem o mesmo em
// common/app-links.util.ts para os avisos push).

export type SocialTab = 'requests' | 'friends' | 'shared' | 'mine';

export const socialTabPath = (tab: SocialTab): string => `/social?tab=${tab}`;

export const friendPath = (userId: string): string => `/social/friends/${encodeURIComponent(userId)}`;

export const friendNotesPath = (userId: string): string => `/social/notes/${encodeURIComponent(userId)}`;

export const sharedNotePath = (token: string): string => `/shared/${encodeURIComponent(token)}`;

/** Abre a nota no teu caderno; com share, abre tambem o painel de partilha. */
export const notebookEntryPath = (entryId: string, { share = false } = {}): string =>
  `/notebook?entry=${encodeURIComponent(entryId)}${share ? '&share=1' : ''}`;

/** Admin: perfil de uma conta (codigo de amigo e ligacoes). */
export const adminUserPath = (userId: string): string => `/users/${encodeURIComponent(userId)}`;

export const PADS_PATH = '/pad';
export const PADS_ADMIN_PATH = '/pads-admin';
export const padPath = (slug: string): string => `${PADS_PATH}/${encodeURIComponent(slug)}`;

export const TURMAS_PATH = '/turmas';
export const turmaPath = (turmaId: string): string => `${TURMAS_PATH}/${encodeURIComponent(turmaId)}`;
export const turmaNotePath = (turmaId: string, noteId: string): string =>
  `${turmaPath(turmaId)}/notes/${encodeURIComponent(noteId)}`;
export const turmaLinkedEntryPath = (turmaId: string, linkId: string, entryId: string): string =>
  `${turmaPath(turmaId)}/subjects/${encodeURIComponent(linkId)}/${encodeURIComponent(entryId)}`;

/** Login que volta para `returnTo` depois de entrar (ver Login.tsx). */
export const loginPathReturningTo = (returnTo: string): string => `/login?redirect=${encodeURIComponent(returnTo)}`;
