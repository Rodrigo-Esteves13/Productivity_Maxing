// Export RGPD completo: ~45 queries sem take por chamada, por isso o limite
// e baixo (o export de finanças tem o seu em finance.constants.ts).
export const DATA_EXPORT_PER_MINUTE = 2;

// Pesquisa do admin (GET /users?q=): tamanho maximo do texto.
export const USER_SEARCH_MAX_LENGTH = 100;

// Providers de login aceites no path /users/:id/providers/:provider.
export const AUTH_PROVIDER = {
  google: 'google',
  github: 'github',
  discord: 'discord',
} as const;
export type AuthProvider = (typeof AUTH_PROVIDER)[keyof typeof AUTH_PROVIDER];

export const SELF_ROLE_CHANGE_MESSAGE =
  'You cannot change your own role. Ask another admin to do it.';
export const SELF_DELETE_MESSAGE =
  'You cannot delete your own account from here. Use "Delete account" in your Profile instead.';
export const SELF_SUSPEND_MESSAGE = 'You cannot suspend your own account.';
export const SELF_BAN_MESSAGE = 'You cannot ban your own account.';
