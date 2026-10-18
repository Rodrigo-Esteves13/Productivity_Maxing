import type { PrismaService } from '../prisma/prisma.service';
import { areFriends } from '../social/friendship.util';

export type SharedRole = 'OWNER' | 'CO_OWNER' | 'EDITOR' | 'VIEWER';

/** O que uma pessoa (ou visitante) pode fazer com uma partilha neste momento. */
export type ShareAccess =
  | { state: 'ok'; role: SharedRole }
  | { state: 'login_required' }
  | { state: 'not_requested' }
  | { state: 'pending' }
  | { state: 'invited'; requestId: string }
  | { state: 'denied' };

interface ShareLike {
  id: string;
  visibility: 'PUBLIC' | 'AUTHORIZED';
  createdByUserId: string;
}

/**
 * Regra UNICA de acesso a uma partilha (usada por leitura e edicao).
 * - dono: OWNER; link PUBLIC: VIEWER para toda a gente.
 * - AUTHORIZED: precisa de sessao e de um pedido APPROVED; convites do dono
 *   (invitedByOwner) so valem enquanto forem amigos - remover/bloquear corta logo.
 */
export async function resolveShareAccess(
  prisma: Pick<PrismaService, 'notebookShareAccessRequest' | 'friendship'>,
  share: ShareLike,
  userId: string | null,
): Promise<ShareAccess> {
  if (userId && share.createdByUserId === userId) {
    return { state: 'ok', role: 'OWNER' };
  }
  if (share.visibility !== 'AUTHORIZED') {
    return { state: 'ok', role: 'VIEWER' };
  }
  if (!userId) return { state: 'login_required' };

  const request = await prisma.notebookShareAccessRequest.findUnique({
    where: {
      notebookShareId_requestingUserId: {
        notebookShareId: share.id,
        requestingUserId: userId,
      },
    },
  });
  if (!request) return { state: 'not_requested' };
  if (request.status === 'DENIED') return { state: 'denied' };
  if (request.status === 'PENDING') {
    return request.invitedByOwner
      ? { state: 'invited', requestId: request.id }
      : { state: 'pending' };
  }
  if (
    request.invitedByOwner &&
    !(await areFriends(prisma, share.createdByUserId, userId))
  ) {
    return { state: 'denied' };
  }
  return { state: 'ok', role: request.accessRole };
}
