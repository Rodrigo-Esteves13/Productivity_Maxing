import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';
import { pushDisplayName } from '../common/display-name.util';
import { SocialService, type SendRequestResult } from './social.service';
import { MAX_FRIENDS } from './social.constants';

// Validade do link de amizade assinado. Passado isto o link continua a
// servir, mas como um pedido normal (a outra pessoa aceita).
export const FRIEND_LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const FRIENDS_PATH = '/social?tab=friends';

export interface FriendLink {
  code: string;
  expires: number;
  token: string;
}

export type FriendLinkStatus =
  'NONE' | 'FRIEND' | 'REQUESTED' | 'INCOMING' | 'SELF';

export interface FriendLinkPreview {
  person: { id: string; name: string | null; avatarUrl: string | null };
  status: FriendLinkStatus;
  /** Link ainda assinado e valido: aceitar torna-vos amigos logo. */
  instant: boolean;
}

// Links de amizade e pedidos por email (sem codigo).
//
// O link leva o codigo de amigo mais uma assinatura com prazo: quem o
// partilhou deu o consentimento, por isso abrir e aceitar torna os dois
// amigos sem mais um passo. Se o link vazar, so vale assim 7 dias; depois
// e um pedido normal. O codigo sozinho (sem assinatura) e sempre so um
// pedido, como ate aqui.
//
// O pedido por email responde sempre o mesmo, exista a conta ou nao, para
// ninguem descobrir quem tem conta na app.
@Injectable()
export class FriendLinksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly social: SocialService,
    private readonly push: PushService,
  ) {}

  async create(userId: string, now = Date.now()): Promise<FriendLink> {
    const code = await this.social.ensureFriendCode(userId);
    const expires = now + FRIEND_LINK_TTL_MS;
    return { code, expires, token: this.sign(code, expires) };
  }

  async preview(
    userId: string,
    code: string,
    expires?: number,
    token?: string,
  ): Promise<FriendLinkPreview> {
    const owner = await this.findOwner(userId, code);
    const status = await this.statusWith(userId, owner.id);
    return {
      person: { id: owner.id, name: owner.name, avatarUrl: owner.avatarUrl },
      status,
      instant: status !== 'SELF' && this.isValid(code, expires, token),
    };
  }

  async accept(
    userId: string,
    code: string,
    expires?: number,
    token?: string,
  ): Promise<SendRequestResult> {
    if (!this.isValid(code, expires, token)) {
      // Sem assinatura (ou expirada): um pedido normal.
      return this.social.sendRequest(userId, code);
    }
    const owner = await this.findOwner(userId, code);
    if (owner.id === userId) {
      throw new BadRequestException('You cannot add yourself.');
    }

    const existing = await this.prisma.friendship.findFirst({
      where: {
        OR: [
          { requesterId: userId, addresseeId: owner.id },
          { requesterId: owner.id, addresseeId: userId },
        ],
      },
      select: { id: true, status: true },
    });
    if (existing?.status === 'ACCEPTED') return { status: 'ACCEPTED' };

    // Limite de amigos dos dois lados, como num pedido aceite.
    const counts = await Promise.all(
      [userId, owner.id].map((id) =>
        this.prisma.friendship.count({
          where: {
            status: 'ACCEPTED',
            OR: [{ requesterId: id }, { addresseeId: id }],
          },
        }),
      ),
    );
    if (counts.some((count) => count >= MAX_FRIENDS)) {
      throw new BadRequestException('Friend limit reached.');
    }

    const decidedAt = new Date();
    if (existing) {
      await this.prisma.friendship.update({
        where: { id: existing.id },
        data: { status: 'ACCEPTED', decidedAt },
      });
    } else {
      await this.prisma.friendship.create({
        data: {
          requesterId: owner.id,
          addresseeId: userId,
          status: 'ACCEPTED',
          decidedAt,
        },
      });
    }

    const me = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    });
    void this.push.notifyUser(owner.id, 'friendLinkJoined', {
      name: pushDisplayName(me),
      url: FRIENDS_PATH,
    });
    return { status: 'ACCEPTED' };
  }

  /**
   * Pedido a quem tem este email. Resposta igual em todos os casos (conta
   * inexistente, pessoa que nao aceita pedidos por email, bloqueio), menos
   * nos limites do proprio remetente, que nao revelam nada sobre o outro.
   */
  async requestByEmail(
    userId: string,
    email: string,
  ): Promise<{ status: 'SENT' }> {
    // Limites primeiro, igual para qualquer email (ver assertCanSendRequests).
    await this.social.assertCanSendRequests(userId);
    const target = await this.prisma.user.findFirst({
      where: {
        email: { equals: email, mode: 'insensitive' },
        allowEmailFriendRequests: true,
        status: { not: 'BANNED' },
      },
      select: { id: true },
    });
    if (target && target.id !== userId) {
      try {
        await this.social.requestToUser(userId, target.id);
      } catch (error) {
        // Bloqueio entre os dois (404) ou limite atingido entretanto (400):
        // fica igual a "nao existe", para a resposta nunca depender da conta.
        if (
          !(error instanceof NotFoundException) &&
          !(error instanceof BadRequestException)
        )
          throw error;
      }
    }
    return { status: 'SENT' };
  }

  async setAllowEmailRequests(
    userId: string,
    allow: boolean,
  ): Promise<{ allowEmailFriendRequests: boolean }> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { allowEmailFriendRequests: allow },
    });
    return { allowEmailFriendRequests: allow };
  }

  private async findOwner(userId: string, code: string) {
    const owner = await this.prisma.user.findUnique({
      where: { friendCode: code },
      select: { id: true, name: true, avatarUrl: true, status: true },
    });
    if (!owner || owner.status === 'BANNED') {
      throw new NotFoundException('Friend link not found.');
    }
    if (owner.id !== userId) {
      const block = await this.prisma.userBlock.count({
        where: {
          OR: [
            { blockerId: owner.id, blockedId: userId },
            { blockerId: userId, blockedId: owner.id },
          ],
        },
      });
      if (block > 0) throw new NotFoundException('Friend link not found.');
    }
    return owner;
  }

  private async statusWith(
    userId: string,
    otherId: string,
  ): Promise<FriendLinkStatus> {
    if (otherId === userId) return 'SELF';
    const row = await this.prisma.friendship.findFirst({
      where: {
        OR: [
          { requesterId: userId, addresseeId: otherId },
          { requesterId: otherId, addresseeId: userId },
        ],
      },
      select: { status: true, requesterId: true },
    });
    if (!row) return 'NONE';
    if (row.status === 'ACCEPTED') return 'FRIEND';
    return row.requesterId === userId ? 'REQUESTED' : 'INCOMING';
  }

  private isValid(code: string, expires?: number, token?: string): boolean {
    if (!token || !expires || !Number.isFinite(expires)) return false;
    if (expires < Date.now() || expires > Date.now() + FRIEND_LINK_TTL_MS) {
      return false;
    }
    const expected = Buffer.from(this.sign(code, expires));
    const given = Buffer.from(token);
    return expected.length === given.length && timingSafeEqual(expected, given);
  }

  private sign(code: string, expires: number): string {
    return createHmac('sha256', this.signingSecret())
      .update(`${code}.${expires}`)
      .digest('base64url')
      .slice(0, 32);
  }

  // Derivado do JWT_SECRET com rotulo proprio (mesma regra dos links de
  // password e de verificacao): nunca vale como sessao nem o contrario.
  private signingSecret(): string {
    const base = process.env.JWT_SECRET;
    if (!base) throw new Error('JWT_SECRET is not defined.');
    return createHmac('sha256', base).update('friend-link-v1').digest('hex');
  }
}
