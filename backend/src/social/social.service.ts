import { pushDisplayName } from '../common/display-name.util';
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
import { SOCIAL_REQUESTS_PATH } from '../common/app-links.util';

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
  allowEmailFriendRequests: boolean;
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

/** O que espera por uma resposta tua no Social (contador da navbar). */
export interface SocialPendingCounts {
  friendRequests: number;
  noteInvitations: number;
  notesRequests: number;
  total: number;
}

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
    const [friendCode, rows, blocks, lastRequest, me] = await Promise.all([
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
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { allowEmailFriendRequests: true },
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
      allowEmailFriendRequests: me?.allowEmailFriendRequests ?? true,
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

  /**
   * So contagens (nada de nomes): pedidos de amizade recebidos, convites de
   * amigos para notas e pedidos para ler as tuas notas, todos pendentes.
   * Corre a cada poucos segundos na navbar, por isso sao tres counts com
   * indice e nada mais.
   */
  async pendingCounts(userId: string): Promise<SocialPendingCounts> {
    const [friendRequests, noteInvitations, notesRequests] = await Promise.all([
      this.prisma.friendship.count({
        where: { addresseeId: userId, status: 'PENDING' },
      }),
      this.prisma.notebookShareAccessRequest.count({
        where: {
          requestingUserId: userId,
          status: 'PENDING',
          invitedByOwner: true,
        },
      }),
      this.prisma.notebookViewGrant.count({
        where: { ownerId: userId, status: 'PENDING' },
      }),
    ]);
    return {
      friendRequests,
      noteInvitations,
      notesRequests,
      total: friendRequests + noteInvitations + notesRequests,
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
    return this.requestTo(userId, target.id);
  }

  /**
   * Pedido sem codigo a um colega de turma: so se os dois estiverem na
   * mesma turma (ja se veem os nomes um ao outro la dentro).
   */
  async sendRequestToClassmate(
    userId: string,
    turmaId: string,
    targetId: string,
  ): Promise<SendRequestResult> {
    if (targetId === userId)
      throw new BadRequestException('You cannot add yourself.');
    const [both, target] = await Promise.all([
      this.prisma.turmaMember.count({
        where: { turmaId, userId: { in: [userId, targetId] } },
      }),
      this.prisma.user.findUnique({
        where: { id: targetId },
        select: { status: true },
      }),
    ]);
    if (both !== 2 || !target || target.status === 'BANNED') {
      throw new NotFoundException('Classmate not found.');
    }
    return this.requestTo(userId, targetId);
  }

  /** Pedido direto a uma conta ja encontrada (ex: pelo email). */
  requestToUser(userId: string, targetId: string): Promise<SendRequestResult> {
    return this.requestTo(userId, targetId);
  }

  /**
   * Limites do proprio (pedidos pendentes, amigos). Publico para o pedido por
   * email os verificar antes de procurar a conta: se so falhasse quando o
   * email existe, o 400 revelava quem esta registado.
   */
  async assertCanSendRequests(userId: string): Promise<void> {
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
  }

  private async requestTo(
    userId: string,
    targetId: string,
  ): Promise<SendRequestResult> {
    const target = { id: targetId };
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

    await this.assertCanSendRequests(userId);

    await this.prisma.friendship.create({
      data: { requesterId: userId, addresseeId: target.id },
    });
    const me = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    });
    void this.push.notifyUser(target.id, 'friendRequest', {
      name: pushDisplayName(me),
      url: SOCIAL_REQUESTS_PATH,
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
