import api from './client';

export interface PublicPerson {
  userId: string;
  name: string | null;
  avatarUrl: string | null;
}

export interface FriendEntry extends PublicPerson {
  friendshipId: string;
  since: string;
}

export interface RequestEntry extends PublicPerson {
  friendshipId: string;
  createdAt: string;
}

export interface SocialOverview {
  friendCode: string;
  friends: FriendEntry[];
  incoming: RequestEntry[];
  outgoing: RequestEntry[];
  blocked: PublicPerson[];
  codeChangeRequest: CodeChangeRequest | null;
}

export interface CodeChangeRequest {
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  adminNote: string | null;
  createdAt: string;
}

export type SendRequestResult = { status: 'PENDING' | 'ACCEPTED' };

export const getSocialOverview = async (): Promise<SocialOverview> =>
  (await api.get<SocialOverview>('/social')).data;

// O codigo nao se troca sozinho: pede-se ao admin, com motivo.
export const requestFriendCodeChange = async (reason: string): Promise<CodeChangeRequest> =>
  (await api.post<CodeChangeRequest>('/social/friend-code/change-request', { reason })).data;

// Admin
export interface FriendCodeRequestRow {
  id: string;
  reason: string;
  createdAt: string;
  user: { id: string; name: string | null; email: string };
}

export const getFriendCodeRequests = async (): Promise<FriendCodeRequestRow[]> =>
  (await api.get<FriendCodeRequestRow[]>('/friend-code-requests')).data;

export const decideFriendCodeRequest = async (id: string, approve: boolean, note?: string): Promise<void> => {
  await api.post(`/friend-code-requests/${id}/decision`, { approve, note: note || undefined });
};

export const sendFriendRequest = async (friendCode: string): Promise<SendRequestResult> =>
  (await api.post<SendRequestResult>('/social/requests', { friendCode })).data;

export const acceptFriendRequest = async (friendshipId: string): Promise<void> => {
  await api.post(`/social/requests/${friendshipId}/accept`);
};

/** Recusar, cancelar pedido enviado ou remover amigo. */
export const removeFriendship = async (friendshipId: string): Promise<void> => {
  await api.delete(`/social/friendships/${friendshipId}`);
};

export const blockUser = async (userId: string): Promise<void> => {
  await api.post('/social/blocks', { userId });
};

export const unblockUser = async (userId: string): Promise<void> => {
  await api.delete(`/social/blocks/${userId}`);
};
