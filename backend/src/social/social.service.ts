import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';
import { areFriends as areFriendsQuery } from './friendship.util';
import { MAX_FRIENDS, MAX_PENDING_OUTGOING } from './social.constants';

/** Unico dado de outra pessoa que sai daqui: nunca email, nunca ids internos alem do userId. */
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
  /** Ultimo pedido de troca de codigo (null se nunca pediu). */
  codeChangeRequest: CodeChangeRequestView | null;
}

export interface CodeChangeRequestView {
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  adminNote: string | null;
  createdAt: string;
}

export type SendRequestResult = { status: 'PENDING' | 'ACCEPTED' };

const PERSON_SELECT = { id: true, name: true, avatarUrl: true } as const;
const person = (u: {
  id: string;
  name: string | null;
  avatarUrl: string | null;
}): PublicPerson => ({
  userId: u.id,
  name: u.name,
  avatarUrl: u.avatarUrl,
});

// Codigo de amigo: 60 bits aleatorios, nao derivado de email/id.
const newFriendCode = () => randomBytes(8).toString('base64url');

@Injectable()
export class SocialService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
  ) {}

  /** Cria o codigo na primeira vez que e preciso (colisao: tenta de novo). */
  async ensureFriendCode(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { friendCode: true },
    });
    if (!user) throw new NotFoundException();
    if (user.friendCode) return user.friendCode;
    for (let i = 0; i < 5; i++) {
      try {
        const updated = await this.prisma.user.update({
          where: { id: userId },
          data: { friendCode: newFriendCode() },
          select: { friendCode: true },
        });
        if (updated.friendCode) return updated.friendCode;
      } catch {
        // violacao de unicidade: gera outro
      }
    }
    throw new BadRequestException('Could not create friend code.');
  }

  /**
   * Gera um codigo novo: o antigo deixa de funcionar. Nao ha rota para o
   * utilizador chamar isto: so a aprovacao de um pedido por um admin.
   */
  async rotateFriendCode(userId: string): Promise<string> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { friendCode: null },
    });
    return this.ensureFriendCode(userId);
  }

  async overview(userId: string): Promise<SocialOverview> {
    const [friendCode, rows, blocks, lastRequest] = await Promise.all([
      this.ensureFriendCode(userId),
      this.prisma.friendship.findMany({
        where: { OR: [{ requesterId: userId }, { addresseeId: userId }] },
        include: {
          requester: { select: PERSON_SELECT },
          addressee: { select: PERSON_SELECT },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.userBlock.findMany({
        where: { blockerId: userId },
        include: { blocked: { select: PERSON_SELECT } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.friendCodeChangeRequest.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: { status: true, adminNote: true, createdAt: true },
      }),
    ]);

    const friends: FriendEntry[] = [];
    const incoming: RequestEntry[] = [];
    const outgoing: RequestEntry[] = [];
    for (const r of rows) {
      const mine = r.requesterId === userId;
      const other = person(mine ? r.addressee : r.requester);
      if (r.status === 'ACCEPTED') {
        friends.push({
          ...other,
          friendshipId: r.id,
          since: (r.decidedAt ?? r.createdAt).toISOString(),
        });
      } else {
        const entry: RequestEntry = {
          ...other,
          friendshipId: r.id,
          createdAt: r.createdAt.toISOString(),
        };
        (mine ? outgoing : incoming).push(entry);
      }
    }
    friends.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
    return {
      friendCode,
      friends,
      incoming,
      outgoing,
      blocked: blocks.map((b) => person(b.blocked)),
      codeChangeRequest: lastRequest
        ? {
            status: lastRequest.status,
            adminNote: lastRequest.adminNote,
            createdAt: lastRequest.createdAt.toISOString(),
          }
        : null,
    };
  }

  async sendRequest(
    userId: string,
    friendCode: string,
  ): Promise<SendRequestResult> {
    const target = await this.prisma.user.findUnique({
      where: { friendCode },
      select: { id: true, status: true },
    });
    // Codigo inexistente, conta bloqueada, ou alguem que nos bloqueou: a mesma
    // resposta, para nao revelar nada.
    if (!target || target.status === 'BANNED')
      throw new NotFoundException('Friend code not found.');
    if (target.id === userId)
      throw new BadRequestException('You cannot add yourself.');

    const block = await this.prisma.userBlock.findFirst({
      where: {
        OR: [
          { blockerId: target.id, blockedId: userId },
          { blockerId: userId, blockedId: target.id },
        ],
      },
      select: { blockerId: true },
    });
    if (block) throw new NotFoundException('Friend code not found.');

    const existing = await this.prisma.friendship.findFirst({
      where: {
        OR: [
          { requesterId: userId, addresseeId: target.id },
          { requesterId: target.id, addresseeId: userId },
        ],
      },
    });
    if (existing) {
      if (existing.status === 'ACCEPTED') return { status: 'ACCEPTED' };
      if (existing.requesterId === userId) return { status: 'PENDING' }; // idempotente
      // A outra pessoa ja tinha pedido: pedir de volta = aceitar.
      await this.accept(userId, existing.id);
      return { status: 'ACCEPTED' };
    }

    const [pending, friendCount] = await Promise.all([
      this.prisma.friendship.count({
        where: { requesterId: userId, status: 'PENDING' },
      }),
      this.prisma.friendship.count({
        where: {
          status: 'ACCEPTED',
          OR: [{ requesterId: userId }, { addresseeId: userId }],
        },
      }),
    ]);
    if (pending >= MAX_PENDING_OUTGOING) {
      throw new BadRequestException('Too many pending requests.');
    }
    if (friendCount >= MAX_FRIENDS)
      throw new BadRequestException('Friend limit reached.');

    await this.prisma.friendship.create({
      data: { requesterId: userId, addresseeId: target.id },
    });
    const me = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });
    void this.push.notifyUser(target.id, 'friendRequest', {
      name: me?.name ?? '',
      url: '/social',
    });
    return { status: 'PENDING' };
  }

  /** So o destinatario aceita. Qualquer outro caso: 404 (nao revela pedidos alheios). */
  async accept(userId: string, friendshipId: string): Promise<void> {
    const res = await this.prisma.friendship.updateMany({
      where: { id: friendshipId, addresseeId: userId, status: 'PENDING' },
      data: { status: 'ACCEPTED', decidedAt: new Date() },
    });
    if (res.count === 0) throw new NotFoundException();
  }

  /** Recusar (destinatario), cancelar (autor) ou remover amigo (qualquer um dos dois). */
  async remove(userId: string, friendshipId: string): Promise<void> {
    const res = await this.prisma.friendship.deleteMany({
      where: {
        id: friendshipId,
        OR: [{ requesterId: userId }, { addresseeId: userId }],
      },
    });
    if (res.count === 0) throw new NotFoundException();
  }

  async block(userId: string, targetId: string): Promise<void> {
    if (targetId === userId) throw new BadRequestException();
    const target = await this.prisma.user.findUnique({
      where: { id: targetId },
      select: { id: true },
    });
    if (!target) throw new NotFoundException();
    await this.prisma.$transaction([
      this.prisma.friendship.deleteMany({
        where: {
          OR: [
            { requesterId: userId, addresseeId: targetId },
            { requesterId: targetId, addresseeId: userId },
          ],
        },
      }),
      this.prisma.userBlock.upsert({
        where: {
          blockerId_blockedId: { blockerId: userId, blockedId: targetId },
        },
        create: { blockerId: userId, blockedId: targetId },
        update: {},
      }),
    ]);
  }

  async unblock(userId: string, targetId: string): Promise<void> {
    await this.prisma.userBlock.deleteMany({
      where: { blockerId: userId, blockedId: targetId },
    });
  }

  /** Para outros modulos (futuros pedidos de acesso): sao amigos aceites? */
  areFriends(a: string, b: string): Promise<boolean> {
    return areFriendsQuery(this.prisma, a, b);
  }
}
