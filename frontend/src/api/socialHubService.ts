import api from './client';

// Espelha NotebookSocialHubService no backend: o que partilhas com cada
// amigo (nos dois sentidos) e a lista das tuas notas partilhadas.
export type HubShareRole = 'VIEWER' | 'EDITOR' | 'CO_OWNER';
export type HubGrantStatus = 'NONE' | 'PENDING' | 'APPROVED';

export interface HubSharedWithMe {
  token: string;
  title: string;
  areaName: string;
  areaColor: string | null;
  role: HubShareRole;
  invited: boolean;
  requestId: string | null;
}

export interface HubSharedByMe {
  entryId: string;
  requestId: string;
  title: string;
  areaName: string;
  areaColor: string | null;
  role: HubShareRole;
  pending: boolean;
}

export interface FriendHub {
  friend: {
    userId: string;
    name: string | null;
    avatarUrl: string | null;
    friendshipId: string;
    since: string;
  };
  sharedWithMe: HubSharedWithMe[];
  sharedByMe: HubSharedByMe[];
  theirNotebook: { status: HubGrantStatus; areaCount: number };
  myNotebook: { status: HubGrantStatus; areaCount: number; grantId: string | null };
  /** Turmas onde estao os dois. */
  commonTurmas: { id: string; name: string }[];
}

export interface MyShare {
  entryId: string;
  title: string;
  areaId: string;
  areaName: string;
  areaColor: string | null;
  visibility: 'PUBLIC' | 'AUTHORIZED';
  peopleCount: number;
  pendingRequests: number;
  pendingInvites: number;
  pendingProposals: number;
  createdAt: string;
}

export const getFriendHub = async (userId: string): Promise<FriendHub> =>
  (await api.get<FriendHub>(`/social/friends/${encodeURIComponent(userId)}`)).data;

export const getMyShares = async (): Promise<MyShare[]> =>
  (await api.get<MyShare[]>('/notebook/shares/mine')).data;
