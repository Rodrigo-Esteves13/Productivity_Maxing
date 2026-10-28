import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';
import { areFriends } from '../social/friendship.util';
import { TurmaAccessService } from './turma-access.service';
import { TurmasService } from './turmas.service';
import { InviteToTurmaDto } from './dto/turma.dto';
import { MAX_PENDING_INVITES_PER_USER, TURMAS_PATH } from './turmas.constants';

export interface TurmaInviter {
  id: string;
  role: string;
}

// Convites diretos: um membro convida um amigo; um admin convida qualquer
// conta (por email). Ficam pendentes ate a pessoa aceitar ou recusar.
@Injectable()
export class TurmaInvitesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: TurmaAccessService,
    private readonly turmas: TurmasService,
    private readonly push: PushService,
  ) {}

  async invite(inviter: TurmaInviter, turmaId: string, dto: InviteToTurmaDto) {
    const { turma } = await this.access.requireMember(inviter.id, turmaId);
    const targetId = await this.resolveTarget(inviter, dto);
    if (targetId === inviter.id) {
      throw new BadRequestException('You are already in this turma.');
    }

    const alreadyMember = await this.prisma.turmaMember.findUnique({
      where: { turmaId_userId: { turmaId, userId: targetId } },
      select: { id: true },
    });
    if (alreadyMember) {
      throw new BadRequestException('This person is already in the turma.');
    }
    const pending = await this.prisma.turmaInvite.count({
      where: { userId: targetId },
    });
    if (pending >= MAX_PENDING_INVITES_PER_USER) {
      throw new BadRequestException('This person has too many invites.');
    }

    // Convidar outra vez nao duplica nem volta a avisar.
    const existing = await this.prisma.turmaInvite.findUnique({
      where: { turmaId_userId: { turmaId, userId: targetId } },
      select: { id: true },
    });
    if (existing) return { id: existing.id };

    const invite = await this.prisma.turmaInvite.create({
      data: { turmaId, userId: targetId, invitedById: inviter.id },
      select: { id: true, invitedBy: { select: { name: true } } },
    });
    void this.push.notifyUser(targetId, 'turmaInvited', {
      name: invite.invitedBy?.name ?? '',
      title: turma.name,
      url: TURMAS_PATH,
    });
    return { id: invite.id };
  }

  /** Convites pendentes do proprio, para a pagina das turmas. */
  async listMine(userId: string) {
    const rows = await this.prisma.turmaInvite.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        createdAt: true,
        turma: {
          select: { name: true, _count: { select: { members: true } } },
        },
        invitedBy: { select: { name: true } },
      },
    });
    return rows.map((row) => ({
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      turmaName: row.turma.name,
      memberCount: row.turma._count.members,
      invitedByName: row.invitedBy?.name ?? null,
    }));
  }

  async accept(userId: string, inviteId: string) {
    const invite = await this.findOwned(userId, inviteId);
    const result = await this.turmas.addMember(invite.turmaId, userId);
    await this.prisma.turmaInvite.deleteMany({
      where: { id: inviteId, userId },
    });
    return result;
  }

  async decline(userId: string, inviteId: string) {
    const { count } = await this.prisma.turmaInvite.deleteMany({
      where: { id: inviteId, userId },
    });
    if (count === 0) throw new NotFoundException('Invite not found.');
  }

  private async findOwned(userId: string, inviteId: string) {
    const invite = await this.prisma.turmaInvite.findFirst({
      where: { id: inviteId, userId },
      select: { turmaId: true },
    });
    if (!invite) throw new NotFoundException('Invite not found.');
    return invite;
  }

  // Membro normal: so amigos, por id. Admin: qualquer conta, por id ou
  // email. Sempre 404 generico (nao revela se a conta existe).
  private async resolveTarget(
    inviter: TurmaInviter,
    dto: InviteToTurmaDto,
  ): Promise<string> {
    const isAdmin = inviter.role === Role.ADMIN;
    if (dto.userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: dto.userId },
        select: { id: true },
      });
      const allowed =
        user &&
        (isAdmin || (await areFriends(this.prisma, inviter.id, user.id)));
      if (!allowed) throw new NotFoundException('User not found.');
      return user.id;
    }
    if (dto.email && isAdmin) {
      const user = await this.prisma.user.findUnique({
        where: { email: dto.email },
        select: { id: true },
      });
      if (!user) throw new NotFoundException('User not found.');
      return user.id;
    }
    throw new NotFoundException('User not found.');
  }
}
