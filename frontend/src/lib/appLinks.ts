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
