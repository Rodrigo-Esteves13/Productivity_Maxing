import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';
import { areFriends } from '../social/friendship.util';
import type { ShareAccessRoleKind } from './dto/decide-access-request.dto';

/** Maximo de pessoas com acesso (convites + pedidos) por nota. */
const MAX_PEOPLE_PER_ENTRY = 30;
/** Depois de recusar um convite, o dono so pode voltar a convidar passado isto. */
const REINVITE_COOLDOWN_MS = 24 * 60 * 60 * 1000;

// Qualquer falha de "esta pessoa nao pode ser convidada" da o mesmo 404, para
// nao revelar quem e (ou deixou de ser) amigo, nem se bloqueou.
const NOT_INVITABLE = 'Friend not found.';

@Injectable()
export class NotebookInviteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
  ) {}

  /**
   * Dono convida um AMIGO para UMA nota com um papel. O convidado tem de
   * aceitar (ninguem recebe acesso sem querer). Exige link AUTHORIZED: num
   * link PUBLIC os papeis nao existem. Sem partilha ainda, cria-a AUTHORIZED.
   */
  async invite(
    ownerId: string,
    entryId: string,
    friendId: string,
    role: ShareAccessRoleKind,
  ) {
    const entry = await this.prisma.notebookEntry.findFirst({
      where: { id: entryId, userId: ownerId },
      select: { id: true, title: true },
    });
    if (!entry) {
      throw new NotFoundException(
        `Notebook entry not found or you don't have access.`,
      );
    }
    if (
      friendId === ownerId ||
      !(await areFriends(this.prisma, ownerId, friendId))
    ) {
      throw new NotFoundException(NOT_INVITABLE);
    }

    let share = await this.prisma.notebookShare.findUnique({
      where: { notebookEntryId: entryId },
    });
    if (share && share.visibility !== 'AUTHORIZED') {
      throw new ConflictException(
        'Switch this share link to "Authorized" before inviting friends with a role.',
      );
    }
    share ??= await this.prisma.notebookShare.create({
      data: {
        notebookEntryId: entryId,
        createdByUserId: ownerId,
        visibility: 'AUTHORIZED',
      },
    });

    const key = {
      notebookShareId_requestingUserId: {
        notebookShareId: share.id,
        requestingUserId: friendId,
      },
    };
    const existing = await this.prisma.notebookShareAccessRequest.findUnique({
      where: key,
    });

    if (!existing) {
      const count = await this.prisma.notebookShareAccessRequest.count({
        where: { notebookShareId: share.id },
      });
      if (count >= MAX_PEOPLE_PER_ENTRY) {
        throw new ConflictException(
          'This note already has the maximum number of people.',
        );
      }
    }

    // Ja tem acesso (pediu pelo link ou aceitou antes): so muda o papel.
    if (existing?.status === 'APPROVED') {
      const updated = await this.prisma.notebookShareAccessRequest.update({
        where: key,
        data: { accessRole: role },
      });
      return { id: updated.id, status: updated.status, accessRole: role };
    }

    // Pediu acesso pelo link e esta pendente: o dono esta a decidir agora.
    if (existing && !existing.invitedByOwner && existing.status === 'PENDING') {
      const updated = await this.prisma.notebookShareAccessRequest.update({
        where: key,
        data: { status: 'APPROVED', accessRole: role, decidedAt: new Date() },
      });
      return { id: updated.id, status: updated.status, accessRole: role };
    }

    if (existing?.invitedByOwner && existing.status === 'PENDING') {
      const updated = await this.prisma.notebookShareAccessRequest.update({
        where: key,
        data: { accessRole: role },
      });
      return { id: updated.id, status: updated.status, accessRole: role };
    }

    if (
      existing?.invitedByOwner &&
      existing.status === 'DENIED' &&
      existing.decidedAt &&
      Date.now() - existing.decidedAt.getTime() < REINVITE_COOLDOWN_MS
    ) {
      throw new ConflictException(
        'This person declined recently. Try again later.',
      );
    }

    const row = await this.prisma.notebookShareAccessRequest.upsert({
      where: key,
      create: {
        notebookShareId: share.id,
        requestingUserId: friendId,
        status: 'PENDING',
        accessRole: role,
        invitedByOwner: true,
      },
      update: {
        status: 'PENDING',
        accessRole: role,
        invitedByOwner: true,
        decidedAt: null,
      },
    });

    const owner = await this.prisma.user.findUnique({
      where: { id: ownerId },
      select: { name: true, email: true },
    });
    void this.push.notifyUser(friendId, 'shareInvited', {
      name: owner?.name ?? owner?.email?.split('@')[0] ?? '',
      title: entry.title,
      url: '/shared-with-me',
    });
    return { id: row.id, status: row.status, accessRole: row.accessRole };
  }

  /** Convidado aceita ou recusa. So o proprio, so convites pendentes. */
  async respond(userId: string, requestId: string, accept: boolean) {
    const request = await this.prisma.notebookShareAccessRequest.findFirst({
      where: {
        id: requestId,
        requestingUserId: userId,
        invitedByOwner: true,
        status: 'PENDING',
      },
      select: {
        id: true,
        notebookShare: {
          select: {
            token: true,
            createdByUserId: true,
            notebookEntry: { select: { title: true } },
          },
        },
      },
    });
    if (!request) throw new NotFoundException('Invitation not found.');

    // Deixaram de ser amigos entre o convite e a resposta: o convite morre.
    if (
      accept &&
      !(await areFriends(
        this.prisma,
        request.notebookShare.createdByUserId,
        userId,
      ))
    ) {
      throw new NotFoundException('Invitation not found.');
    }

    const updated = await this.prisma.notebookShareAccessRequest.update({
      where: { id: request.id },
      data: { status: accept ? 'APPROVED' : 'DENIED', decidedAt: new Date() },
    });
    // So avisa o dono quando aceitam (uma recusa nao apita, evita mal-estar).
    if (accept) {
      const me = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, email: true },
      });
      void this.push.notifyUser(
        request.notebookShare.createdByUserId,
        'shareInviteAccepted',
        {
          name: me?.name ?? me?.email?.split('@')[0] ?? '',
          title: request.notebookShare.notebookEntry.title,
          url: '/notebook',
        },
      );
    }
    return {
      id: updated.id,
      status: updated.status,
      token: accept ? request.notebookShare.token : null,
    };
  }

  /** Dono tira o acesso (ou cancela um convite) a uma pessoa desta nota. */
  async removeAccess(ownerId: string, entryId: string, requestId: string) {
    const result = await this.prisma.notebookShareAccessRequest.deleteMany({
      where: {
        id: requestId,
        notebookShare: {
          notebookEntryId: entryId,
          createdByUserId: ownerId,
        },
      },
    });
    if (result.count === 0) {
      throw new NotFoundException('Access not found.');
    }
    return { removed: true as const };
  }
}
