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
  // Quem sabe o teu email pode enviar-te um pedido (sem codigo).
  allowEmailFriendRequests: boolean;
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

// So contagens, para o numero ao lado de Social na navbar.
export interface SocialPendingCounts {
  friendRequests: number;
  noteInvitations: number;
  notesRequests: number;
  total: number;
}

export const getSocialPending = async (): Promise<SocialPendingCounts> =>
  (await api.get<SocialPendingCounts>('/social/pending')).data;

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

// Igual ao take de FriendCodeRequestsService.listPending no backend (E-14).
export const FRIEND_CODE_QUEUE_LIMIT = 200;

export const getFriendCodeRequests = async (): Promise<FriendCodeRequestRow[]> =>
  (await api.get<FriendCodeRequestRow[]>('/friend-code-requests')).data;

export const decideFriendCodeRequest = async (id: string, approve: boolean, note?: string): Promise<void> => {
  await api.post(`/friend-code-requests/${id}/decision`, { approve, note: note || undefined });
};

export const sendFriendRequest = async (friendCode: string): Promise<SendRequestResult> =>
  (await api.post<SendRequestResult>('/social/requests', { friendCode })).data;

/**
 * Pedido a quem tem este email. A resposta e sempre a mesma, exista a conta
 * ou nao (nao revela quem tem conta).
 */
export const sendEmailFriendRequest = async (email: string): Promise<void> => {
  await api.post('/social/requests/email', { email });
};

export const setAllowEmailFriendRequests = async (allow: boolean): Promise<void> => {
  await api.patch('/social/settings', { allowEmailFriendRequests: allow });
};

// Link de amizade assinado: valido 7 dias, quem o abre e aceita fica logo
// amigo. Sem assinatura (ou expirado) vale como pedido normal.
export interface FriendLink {
  code: string;
  expires: number;
  token: string;
}

export type FriendLinkStatus = 'NONE' | 'FRIEND' | 'REQUESTED' | 'INCOMING' | 'SELF';

export interface FriendLinkPreview {
  person: { id: string; name: string | null; avatarUrl: string | null };
  status: FriendLinkStatus;
  instant: boolean;
}

export interface FriendLinkParams {
  friendCode: string;
  expires?: number;
  token?: string;
}

export const createFriendLink = async (): Promise<FriendLink> =>
  (await api.get<FriendLink>('/social/friend-link')).data;

export const previewFriendLink = async (params: FriendLinkParams): Promise<FriendLinkPreview> =>
  (await api.get<FriendLinkPreview>('/social/friend-link/preview', { params })).data;

export const acceptFriendLink = async (params: FriendLinkParams): Promise<SendRequestResult> =>
  (await api.post<SendRequestResult>('/social/friend-link/accept', params)).data;

/** Pedido sem codigo a alguem da mesma turma. */
export const sendClassmateFriendRequest = async (turmaId: string, userId: string): Promise<SendRequestResult> =>
  (await api.post<SendRequestResult>('/social/requests/classmate', { turmaId, userId })).data;

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
