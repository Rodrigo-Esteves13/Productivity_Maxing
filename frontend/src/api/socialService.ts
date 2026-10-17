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
}

export type SendRequestResult = { status: 'PENDING' | 'ACCEPTED' };

export const getSocialOverview = async (): Promise<SocialOverview> =>
  (await api.get<SocialOverview>('/social')).data;

export const regenerateFriendCode = async (): Promise<string> =>
  (await api.post<{ friendCode: string }>('/social/friend-code/regenerate')).data.friendCode;

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
