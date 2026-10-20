import api from './client';
import type { Role, UserStatus } from '../types/models';

// Admin: ligacoes sociais de uma conta (ver admin-social.service.ts no backend).
export interface AdminPerson {
  userId: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
  status: UserStatus;
}

export interface AdminDatedPerson extends AdminPerson {
  at: string;
}

export interface AdminNotesReader extends AdminPerson {
  grantStatus: 'PENDING' | 'APPROVED' | 'DENIED';
  areaCount: number;
}

export type ShareAccessRole = 'VIEWER' | 'EDITOR' | 'CO_OWNER';

export interface AdminSharedPerson extends AdminPerson {
  items: number;
  roles: ShareAccessRole[];
}

export interface AdminCodeRequest {
  id: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reason: string;
  adminNote: string | null;
  createdAt: string;
  decidedAt: string | null;
}

export interface AdminSocialProfile {
  user: AdminPerson & { role: Role; createdAt: string };
  friendCode: string | null;
  friends: AdminDatedPerson[];
  incoming: AdminDatedPerson[];
  outgoing: AdminDatedPerson[];
  blocked: AdminDatedPerson[];
  blockedBy: AdminDatedPerson[];
  readers: AdminNotesReader[];
  reading: AdminNotesReader[];
  sharedWith: AdminSharedPerson[];
  sharedBy: AdminSharedPerson[];
  codeRequests: AdminCodeRequest[];
}

export const getAdminSocialProfile = async (userId: string): Promise<AdminSocialProfile> =>
  (await api.get<AdminSocialProfile>(`/admin/social/users/${userId}`)).data;

export const regenerateFriendCode = async (userId: string): Promise<string> =>
  (await api.post<{ friendCode: string }>(`/admin/social/users/${userId}/friend-code`)).data.friendCode;
