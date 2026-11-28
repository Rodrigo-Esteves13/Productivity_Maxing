import type { SecurityLog } from '../../types/models';

// Linhas que nao sao bloqueios de rate limit (moderacao de pads pelo
// admin, E-08): mostradas com um rotulo em vez de parecerem um ataque.
export const SECURITY_LOG_TYPE_LABEL_KEYS: Partial<Record<SecurityLog['type'], string>> = {
  ADMIN_PAD_DELETED: 'ui.securityTypeAdminPadDeleted',
  ADMIN_PAD_SOURCE_BLOCKED: 'ui.securityTypeAdminPadSourceBlocked',
  REFRESH_TOKEN_REUSE: 'devices.securityTypeRefreshReuse',
};

export const SECURITY_LOG_METHOD_STYLES: Record<string, string> = {
  GET: 'text-sky-400',
  POST: 'text-violet-400',
  PATCH: 'text-amber-400',
  PUT: 'text-amber-400',
  DELETE: 'text-red-400',
};
