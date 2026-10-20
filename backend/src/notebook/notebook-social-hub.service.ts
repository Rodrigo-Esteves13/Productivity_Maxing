import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type HubShareRole = 'VIEWER' | 'EDITOR' | 'CO_OWNER';
export type HubGrantStatus = 'NONE' | 'PENDING' | 'APPROVED';

/** Uma nota do amigo a que tens acesso (ou para a qual ele te convidou). */
export interface HubSharedWithMe {
  token: string;
  title: string;
  areaName: string;
  areaColor: string | null;
  role: HubShareRole;
  /** Convite a espera da tua resposta (requestId para aceitar/recusar). */
  invited: boolean;
  requestId: string | null;
}

/** Uma nota tua a que o amigo tem acesso (ou para a qual o convidaste). */
export interface HubSharedByMe {
  entryId: string;
  requestId: string;
  title: string;
  areaName: string;
  areaColor: string | null;
  role: HubShareRole;
  /** true = convite ainda sem resposta do amigo. */
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
  /** Tu a ler o caderno dele. Recusado aparece como PENDING (igual a outgoing). */
  theirNotebook: { status: HubGrantStatus; areaCount: number };
  /** Ele a ler o teu caderno. */
  myNotebook: {
    status: HubGrantStatus;
    areaCount: number;
    grantId: string | null;
  };
}

/** Uma nota tua com link de partilha, com quem a ve e o que espera por ti. */
export interface MyShare {
  entryId: string;
  title: string;
  areaId: string;
  areaName: string;
  areaColor: string | null;
  visibility: 'PUBLIC' | 'AUTHORIZED';
  /** Pessoas com acesso aprovado. */
  peopleCount: number;
  /** Pedidos de acesso pelo link a espera da tua decisao. */
  pendingRequests: number;
  /** Convites teus ainda sem resposta. */
  pendingInvites: number;
  /** Propostas de editores a espera de aprovacao. */
  pendingProposals: number;
  createdAt: string;
}

const MAX_ITEMS = 100;

const ENTRY_SELECT = {
  id: true,
  title: true,
  areaId: true,
  area: { select: { name: true, colorHex: true } },
} as const;

/**
 * Junta o Social e as partilhas de notas: o que partilhas com cada amigo (nos
 * dois sentidos) e a lista das tuas notas partilhadas. So contagens e
 * metadados que cada lado ja podia ver noutro sitio - nunca emails, nem
 * conteudo de notas a que nao tens acesso.
 */
@Injectable()
export class NotebookSocialHubService {
  constructor(private readonly prisma: PrismaService) {}

  async friendHub(userId: string, friendId: string): Promise<FriendHub> {
    if (userId === friendId) throw new NotFoundException();
    const friendship = await this.prisma.friendship.findFirst({
      where: {
        status: 'ACCEPTED',
        OR: [
          { requesterId: userId, addresseeId: friendId },
          { requesterId: friendId, addresseeId: userId },
        ],
      },
      select: { id: true, createdAt: true, decidedAt: true },
    });
    // Nao amigo (ou bloqueado, que apaga a amizade): 404 igual a "nao existe".
    if (!friendship) throw new NotFoundException();

    const [friend, withMe, byMe, theirGrant, myGrant] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: friendId },
        select: { id: true, name: true, avatarUrl: true },
      }),
      this.prisma.notebookShareAccessRequest.findMany({
        where: {
          requestingUserId: userId,
          notebookShare: { createdByUserId: friendId },
          OR: [
            { status: 'APPROVED' },
            { status: 'PENDING', invitedByOwner: true },
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: MAX_ITEMS,
        select: {
          id: true,
          status: true,
          accessRole: true,
          invitedByOwner: true,
          notebookShare: {
            select: {
              token: true,
              notebookEntry: { select: ENTRY_SELECT },
            },
          },
        },
      }),
      this.prisma.notebookShareAccessRequest.findMany({
        where: {
          requestingUserId: friendId,
          notebookShare: { createdByUserId: userId },
          OR: [
            { status: 'APPROVED' },
            { status: 'PENDING', invitedByOwner: true },
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: MAX_ITEMS,
        select: {
          id: true,
          status: true,
          accessRole: true,
          notebookShare: {
            select: { notebookEntry: { select: ENTRY_SELECT } },
          },
        },
      }),
      this.prisma.notebookViewGrant.findUnique({
        where: { ownerId_viewerId: { ownerId: friendId, viewerId: userId } },
        select: { status: true, areaIds: true },
      }),
      this.prisma.notebookViewGrant.findUnique({
        where: { ownerId_viewerId: { ownerId: userId, viewerId: friendId } },
        select: { id: true, status: true, areaIds: true },
      }),
    ]);
    if (!friend) throw new NotFoundException();

    return {
      friend: {
        userId: friend.id,
        name: friend.name,
        avatarUrl: friend.avatarUrl,
        friendshipId: friendship.id,
        since: (friendship.decidedAt ?? friendship.createdAt).toISOString(),
      },
      sharedWithMe: withMe.map((r) => {
        const invited = r.status === 'PENDING';
        const entry = r.notebookShare.notebookEntry;
        return {
          token: r.notebookShare.token,
          title: entry.title,
          areaName: entry.area.name,
          areaColor: entry.area.colorHex,
          role: r.accessRole,
          invited,
          requestId: invited ? r.id : null,
        };
      }),
      sharedByMe: byMe.map((r) => {
        const entry = r.notebookShare.notebookEntry;
        return {
          entryId: entry.id,
          requestId: r.id,
          title: entry.title,
          areaName: entry.area.name,
          areaColor: entry.area.colorHex,
          role: r.accessRole,
          pending: r.status === 'PENDING',
        };
      }),
      theirNotebook: theirGrant
        ? {
            // Quem pede nao fica a saber que foi recusado.
            status: theirGrant.status === 'APPROVED' ? 'APPROVED' : 'PENDING',
            areaCount:
              theirGrant.status === 'APPROVED' ? theirGrant.areaIds.length : 0,
          }
        : { status: 'NONE', areaCount: 0 },
      myNotebook:
        myGrant && myGrant.status !== 'DENIED'
          ? {
              status: myGrant.status,
              areaCount:
                myGrant.status === 'APPROVED' ? myGrant.areaIds.length : 0,
              grantId: myGrant.id,
            }
          : { status: 'NONE', areaCount: 0, grantId: null },
    };
  }

  async myShares(userId: string): Promise<MyShare[]> {
    const shares = await this.prisma.notebookShare.findMany({
      where: { createdByUserId: userId },
      orderBy: { createdAt: 'desc' },
      take: MAX_ITEMS,
      select: {
        id: true,
        visibility: true,
        createdAt: true,
        notebookEntryId: true,
        notebookEntry: { select: ENTRY_SELECT },
      },
    });
    if (shares.length === 0) return [];

    const shareIds = shares.map((s) => s.id);
    const entryIds = shares.map((s) => s.notebookEntryId);
    const [requests, proposals] = await Promise.all([
      this.prisma.notebookShareAccessRequest.groupBy({
        by: ['notebookShareId', 'status', 'invitedByOwner'],
        where: { notebookShareId: { in: shareIds } },
        _count: { _all: true },
      }),
      this.prisma.notebookChangeProposal.groupBy({
        by: ['notebookEntryId'],
        where: { notebookEntryId: { in: entryIds }, status: 'PENDING' },
        _count: { _all: true },
      }),
    ]);

    const countFor = (
      shareId: string,
      status: string,
      invitedByOwner?: boolean,
    ) =>
      requests
        .filter(
          (r) =>
            r.notebookShareId === shareId &&
            r.status === status &&
            (invitedByOwner === undefined ||
              r.invitedByOwner === invitedByOwner),
        )
        .reduce((sum, r) => sum + r._count._all, 0);
    const proposalsByEntry = new Map(
      proposals.map((p) => [p.notebookEntryId, p._count._all]),
    );

    return shares.map((s) => ({
      entryId: s.notebookEntryId,
      title: s.notebookEntry.title,
      areaId: s.notebookEntry.areaId,
      areaName: s.notebookEntry.area.name,
      areaColor: s.notebookEntry.area.colorHex,
      visibility: s.visibility,
      peopleCount: countFor(s.id, 'APPROVED'),
      pendingRequests: countFor(s.id, 'PENDING', false),
      pendingInvites: countFor(s.id, 'PENDING', true),
      pendingProposals: proposalsByEntry.get(s.notebookEntryId) ?? 0,
      createdAt: s.createdAt.toISOString(),
    }));
  }
}
