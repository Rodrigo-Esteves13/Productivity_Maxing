import type { ShareAccessRole } from '../../../types/models';

export const ROLES: ShareAccessRole[] = ['VIEWER', 'EDITOR', 'CO_OWNER'];
export const ROLE_KEY: Record<ShareAccessRole, string> = {
  VIEWER: 'share.role.viewer',
  EDITOR: 'share.role.editor',
  CO_OWNER: 'share.role.coOwner',
};
