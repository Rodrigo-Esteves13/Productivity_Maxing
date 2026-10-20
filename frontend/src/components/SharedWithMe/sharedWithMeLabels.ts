import type { SharedWithMeRole } from '../../api/notebookService';

export const ROLE_KEY: Record<SharedWithMeRole, string> = {
  VIEWER: 'sharedWithMe.role.viewer',
  EDITOR: 'sharedWithMe.role.editor',
  CO_OWNER: 'sharedWithMe.role.coOwner',
};

// Cor vem do servidor (colorHex da Area): so se aceita #rgb/#rrggbb, nunca
// texto livre dentro de um style.
export const isHexColor = (value: string | null): value is string =>
  value !== null && /^#[0-9a-fA-F]{3,8}$/.test(value);

export const FALLBACK_AREA_COLOR = '#808080';

export const areaColorOf = (value: string | null): string =>
  isHexColor(value) ? value : FALLBACK_AREA_COLOR;
