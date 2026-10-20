import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  FriendCodeChangeStatus,
  Role,
  ShareAccessRequestStatus,
  ShareAccessRole,
  UserStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SocialService } from './social.service';

/** Pessoa vista pelo admin: ao contrario do Social, inclui email e estado da conta. */
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
  grantStatus: ShareAccessRequestStatus;
  areaCount: number;
}

export interface AdminSharedPerson extends AdminPerson {
  items: number;
  roles: ShareAccessRole[];
}

export interface AdminCodeRequest {
  id: string;
  status: FriendCodeChangeStatus;
  reason: string;
  adminNote: string | null;
  createdAt: string;
  decidedAt: string | null;
}

export interface AdminSocialProfile {
  user: AdminPerson & { role: Role; createdAt: string };
  /** null = ainda nao abriu o Social (o codigo nasce na primeira visita). */
  friendCode: string | null;
  friends: AdminDatedPerson[];
  incoming: AdminDatedPerson[];
  outgoing: AdminDatedPerson[];
  blocked: AdminDatedPerson[];
  blockedBy: AdminDatedPerson[];
  /** Pedidos/permissoes de leitura das notas (NotebookViewGrant), nos dois sentidos. */
  readers: AdminNotesReader[];
  reading: AdminNotesReader[];
  /** Notas partilhadas item a item com acesso aprovado, agrupadas por pessoa. */
  sharedWith: AdminSharedPerson[];
  sharedBy: AdminSharedPerson[];
  codeRequests: AdminCodeRequest[];
}

const ADMIN_PERSON_SELECT = {
  id: true,
  name: true,
  email: true,
  avatarUrl: true,
  status: true,
} as const;

type PersonRow = {
  id: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
  status: UserStatus;
};

const adminPerson = (u: PersonRow): AdminPerson => ({
  userId: u.id,
  name: u.name,
  email: u.email,
  avatarUrl: u.avatarUrl,
  status: u.status,
});

const byName = (a: AdminPerson, b: AdminPerson) =>
  (a.name ?? a.email).localeCompare(b.name ?? b.email);

// Limites so para nenhuma conta estranha rebentar a resposta: MAX_FRIENDS e 200.
const MAX_ROWS = 500;
const MAX_SHARED_ROWS = 2000;
const CODE_REQUEST_HISTORY = 10;

// Admin: ver as ligacoes de uma pessoa (amizades, pedidos, bloqueios, notas
// partilhadas) e trocar o codigo de amigo quando quiser, sem pedido.
@Injectable()
export class AdminSocialService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly social: SocialService,
  ) {}

  async profile(userId: string): Promise<AdminSocialProfile> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        ...ADMIN_PERSON_SELECT,
        role: true,
        createdAt: true,
        friendCode: true,
      },
    });
    if (!user) throw new NotFoundException('User not found.');

    const [friendships, blocks, grants, sharedAccess, codeRequests] =
      await Promise.all([
        this.prisma.friendship.findMany({
          where: { OR: [{ requesterId: userId }, { addresseeId: userId }] },
          include: {
            requester: { select: ADMIN_PERSON_SELECT },
            addressee: { select: ADMIN_PERSON_SELECT },
          },
          orderBy: { createdAt: 'desc' },
          take: MAX_ROWS,
        }),
        this.prisma.userBlock.findMany({
          where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
          include: {
            blocker: { select: ADMIN_PERSON_SELECT },
            blocked: { select: ADMIN_PERSON_SELECT },
          },
          orderBy: { createdAt: 'desc' },
          take: MAX_ROWS,
        }),
        this.prisma.notebookViewGrant.findMany({
          where: {
            status: { not: 'DENIED' },
            OR: [{ ownerId: userId }, { viewerId: userId }],
          },
          include: {
            owner: { select: ADMIN_PERSON_SELECT },
            viewer: { select: ADMIN_PERSON_SELECT },
          },
          orderBy: { createdAt: 'desc' },
          take: MAX_ROWS,
        }),
        this.prisma.notebookShareAccessRequest.findMany({
          where: {
            status: 'APPROVED',
            OR: [
              { requestingUserId: userId },
              { notebookShare: { createdByUserId: userId } },
            ],
          },
          select: {
            accessRole: true,
            requestingUser: { select: ADMIN_PERSON_SELECT },
            notebookShare: {
              select: { createdBy: { select: ADMIN_PERSON_SELECT } },
            },
          },
          take: MAX_SHARED_ROWS,
        }),
        this.prisma.friendCodeChangeRequest.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: CODE_REQUEST_HISTORY,
          select: {
            id: true,
            status: true,
            reason: true,
            adminNote: true,
            createdAt: true,
            decidedAt: true,
          },
        }),
      ]);

    const friends: AdminDatedPerson[] = [];
    const incoming: AdminDatedPerson[] = [];
    const outgoing: AdminDatedPerson[] = [];
    for (const f of friendships) {
      const mine = f.requesterId === userId;
      const other = adminPerson(mine ? f.addressee : f.requester);
      if (f.status === 'ACCEPTED') {
        friends.push({
          ...other,
          at: (f.decidedAt ?? f.createdAt).toISOString(),
        });
      } else {
        (mine ? outgoing : incoming).push({
          ...other,
          at: f.createdAt.toISOString(),
        });
      }
    }
    friends.sort(byName);

    const blocked: AdminDatedPerson[] = [];
    const blockedBy: AdminDatedPerson[] = [];
    for (const b of blocks) {
      if (b.blockerId === userId) {
        blocked.push({
          ...adminPerson(b.blocked),
          at: b.createdAt.toISOString(),
        });
      } else {
        blockedBy.push({
          ...adminPerson(b.blocker),
          at: b.createdAt.toISOString(),
        });
      }
    }

    const readers: AdminNotesReader[] = [];
    const reading: AdminNotesReader[] = [];
    for (const g of grants) {
      const owner = g.ownerId === userId;
      (owner ? readers : reading).push({
        ...adminPerson(owner ? g.viewer : g.owner),
        grantStatus: g.status,
        areaCount: g.areaIds.length,
      });
    }

    const sharedWith = new Map<string, AdminSharedPerson>();
    const sharedBy = new Map<string, AdminSharedPerson>();
    for (const a of sharedAccess) {
      const owner = a.notebookShare.createdBy;
      const ownedByUser = owner.id === userId;
      // A propria pessoa nao conta como ligacao a si mesma.
      const other = ownedByUser ? a.requestingUser : owner;
      if (other.id === userId) continue;
      const target = ownedByUser ? sharedWith : sharedBy;
      const entry = target.get(other.id) ?? {
        ...adminPerson(other),
        items: 0,
        roles: [],
      };
      entry.items += 1;
      if (!entry.roles.includes(a.accessRole)) entry.roles.push(a.accessRole);
      target.set(other.id, entry);
    }

    return {
      user: {
        ...adminPerson(user),
        role: user.role,
        createdAt: user.createdAt.toISOString(),
      },
      friendCode: user.friendCode,
      friends,
      incoming,
      outgoing,
      blocked,
      blockedBy,
      readers: readers.sort(byName),
      reading: reading.sort(byName),
      sharedWith: [...sharedWith.values()].sort(byName),
      sharedBy: [...sharedBy.values()].sort(byName),
      codeRequests: codeRequests.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
        decidedAt: r.decidedAt?.toISOString() ?? null,
      })),
    };
  }

  /**
   * Codigo novo a qualquer momento, sem pedido. O antigo deixa de funcionar;
   * as amizades ficam. Um pedido pendente da pessoa fica resolvido (aprovado)
   * por esta troca, para nao ficar na fila a pedir o que ja foi feito.
   */
  async regenerateFriendCode(
    adminId: string,
    userId: string,
  ): Promise<{ friendCode: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('User not found.');
    const friendCode = await this.social.rotateFriendCode(userId);
    await this.prisma.friendCodeChangeRequest.updateMany({
      where: { userId, status: 'PENDING' },
      data: { status: 'APPROVED', decidedAt: new Date(), decidedById: adminId },
    });
    return { friendCode };
  }
}
