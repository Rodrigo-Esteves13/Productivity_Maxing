import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TurmaRole } from '@prisma/client';
import { randomInt } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { TurmaAccessService } from './turma-access.service';
import { TurmaFilesService } from './turma-files.service';
import {
  CreateTurmaDto,
  TransferDelegadoDto,
  UpdateTurmaDto,
} from './dto/turma.dto';
import {
  INVITE_CODE_ALPHABET,
  INVITE_CODE_LENGTH,
  MAX_MEMBERS_PER_TURMA,
  MAX_TURMAS_PER_USER,
} from './turmas.constants';

const UNIQUE_VIOLATION = 'P2002';
const INVITE_CODE_ATTEMPTS = 5;

function generateInviteCode(): string {
  return Array.from(
    { length: INVITE_CODE_LENGTH },
    () => INVITE_CODE_ALPHABET[randomInt(INVITE_CODE_ALPHABET.length)],
  ).join('');
}

function isUniqueViolation(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === UNIQUE_VIOLATION
  );
}

@Injectable()
export class TurmasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: TurmaAccessService,
    private readonly files: TurmaFilesService,
  ) {}

  async listMine(userId: string) {
    const memberships = await this.prisma.turmaMember.findMany({
      where: { userId },
      orderBy: { joinedAt: 'asc' },
      select: {
        role: true,
        turma: {
          select: {
            id: true,
            name: true,
            description: true,
            _count: { select: { members: true } },
          },
        },
      },
    });
    return memberships.map(({ role, turma }) => ({
      id: turma.id,
      name: turma.name,
      description: turma.description,
      memberCount: turma._count.members,
      myRole: role,
    }));
  }

  async create(userId: string, dto: CreateTurmaDto) {
    await this.assertCanJoinMore(userId);
    for (let attempt = 0; attempt < INVITE_CODE_ATTEMPTS; attempt++) {
      try {
        return await this.prisma.turma.create({
          data: {
            name: dto.name,
            description: dto.description || null,
            inviteCode: generateInviteCode(),
            createdById: userId,
            members: { create: { userId, role: TurmaRole.DELEGADO } },
          },
          select: { id: true },
        });
      } catch (err) {
        if (!isUniqueViolation(err)) throw err;
      }
    }
    throw new ConflictException('Could not create the turma. Try again.');
  }

  async join(userId: string, code: string) {
    const turma = await this.prisma.turma.findUnique({
      where: { inviteCode: code },
      select: { id: true, _count: { select: { members: true } } },
    });
    if (!turma) throw new NotFoundException('Invalid invite code.');

    const existing = await this.prisma.turmaMember.findUnique({
      where: { turmaId_userId: { turmaId: turma.id, userId } },
      select: { id: true },
    });
    if (existing) return { id: turma.id };

    if (turma._count.members >= MAX_MEMBERS_PER_TURMA) {
      throw new BadRequestException('This turma is full.');
    }
    await this.assertCanJoinMore(userId);
    try {
      await this.prisma.turmaMember.create({
        data: { turmaId: turma.id, userId },
      });
    } catch (err) {
      // Dois pedidos ao mesmo tempo: o segundo encontra o primeiro.
      if (!isUniqueViolation(err)) throw err;
    }
    return { id: turma.id };
  }

  async get(userId: string, turmaId: string) {
    const membership = await this.access.requireMember(userId, turmaId);
    await this.ensureDelegado(turmaId);
    const turma = await this.prisma.turma.findUniqueOrThrow({
      where: { id: turmaId },
      select: {
        id: true,
        name: true,
        description: true,
        inviteCode: true,
        membersCanEditNotes: true,
        members: {
          orderBy: { joinedAt: 'asc' },
          select: {
            role: true,
            joinedAt: true,
            user: { select: { id: true, name: true, avatarUrl: true } },
          },
        },
      },
    });
    const myRole =
      turma.members.find((m) => m.user.id === userId)?.role ?? membership.role;
    return {
      ...turma,
      myRole,
      canEditNotes: this.access.canEditNotes({ ...membership, role: myRole }),
      members: turma.members.map((m) => ({
        userId: m.user.id,
        name: m.user.name,
        avatarUrl: m.user.avatarUrl,
        role: m.role,
        joinedAt: m.joinedAt.toISOString(),
      })),
    };
  }

  async update(userId: string, turmaId: string, dto: UpdateTurmaDto) {
    await this.access.requireDelegado(userId, turmaId);
    await this.prisma.turma.update({
      where: { id: turmaId },
      data: {
        name: dto.name,
        description:
          dto.description === undefined ? undefined : dto.description || null,
        membersCanEditNotes: dto.membersCanEditNotes,
      },
    });
    return this.get(userId, turmaId);
  }

  async regenerateInviteCode(userId: string, turmaId: string) {
    await this.access.requireDelegado(userId, turmaId);
    for (let attempt = 0; attempt < INVITE_CODE_ATTEMPTS; attempt++) {
      try {
        return await this.prisma.turma.update({
          where: { id: turmaId },
          data: { inviteCode: generateInviteCode() },
          select: { inviteCode: true },
        });
      } catch (err) {
        if (!isUniqueViolation(err)) throw err;
      }
    }
    throw new ConflictException('Could not create a new code. Try again.');
  }

  async remove(userId: string, turmaId: string) {
    await this.access.requireDelegado(userId, turmaId);
    await this.deleteTurma(turmaId);
    return { deleted: true };
  }

  async leave(userId: string, turmaId: string) {
    const membership = await this.access.requireMember(userId, turmaId);
    const others = await this.prisma.turmaMember.count({
      where: { turmaId, userId: { not: userId } },
    });
    if (others === 0) {
      await this.deleteTurma(turmaId);
      return { left: true, deleted: true };
    }
    if (membership.role === TurmaRole.DELEGADO) {
      throw new BadRequestException(
        'Make another member the delegado before leaving.',
      );
    }
    await this.removeMembership(turmaId, userId);
    return { left: true, deleted: false };
  }

  async removeMember(userId: string, turmaId: string, targetUserId: string) {
    await this.access.requireDelegado(userId, turmaId);
    if (targetUserId === userId) {
      throw new BadRequestException('Use Leave to leave the turma.');
    }
    const removed = await this.removeMembership(turmaId, targetUserId);
    if (!removed) throw new NotFoundException('Member not found.');
    return { removed: true };
  }

  async transferDelegado(
    userId: string,
    turmaId: string,
    dto: TransferDelegadoDto,
  ) {
    await this.access.requireDelegado(userId, turmaId);
    if (dto.userId === userId) {
      throw new BadRequestException('You are already the delegado.');
    }
    const target = await this.prisma.turmaMember.findUnique({
      where: { turmaId_userId: { turmaId, userId: dto.userId } },
      select: { id: true },
    });
    if (!target) throw new NotFoundException('Member not found.');
    await this.prisma.$transaction([
      this.prisma.turmaMember.update({
        where: { id: target.id },
        data: { role: TurmaRole.DELEGADO },
      }),
      this.prisma.turmaMember.update({
        where: { turmaId_userId: { turmaId, userId } },
        data: { role: TurmaRole.MEMBER },
      }),
    ]);
    return this.get(userId, turmaId);
  }

  private async assertCanJoinMore(userId: string): Promise<void> {
    const count = await this.prisma.turmaMember.count({ where: { userId } });
    if (count >= MAX_TURMAS_PER_USER) {
      throw new BadRequestException(
        `You can be in at most ${MAX_TURMAS_PER_USER} turmas.`,
      );
    }
  }

  // Sair ou ser removido tira tambem as cadeiras que essa pessoa publicou.
  private async removeMembership(
    turmaId: string,
    userId: string,
  ): Promise<boolean> {
    const [, , removed] = await this.prisma.$transaction([
      this.prisma.turmaLinkedArea.deleteMany({ where: { turmaId, userId } }),
      this.prisma.turmaPack.deleteMany({
        where: { turmaId, sharedById: userId },
      }),
      this.prisma.turmaMember.deleteMany({ where: { turmaId, userId } }),
    ]);
    return removed.count > 0;
  }

  private async deleteTurma(turmaId: string): Promise<void> {
    await this.files.removeAllFor(turmaId);
    await this.prisma.turma.delete({ where: { id: turmaId } });
  }

  // Se a conta do delegado for apagada, o membro mais antigo passa a delegado
  // para a turma nunca ficar sem quem a gira.
  private async ensureDelegado(turmaId: string): Promise<void> {
    const delegados = await this.prisma.turmaMember.count({
      where: { turmaId, role: TurmaRole.DELEGADO },
    });
    if (delegados > 0) return;
    const oldest = await this.prisma.turmaMember.findFirst({
      where: { turmaId },
      orderBy: { joinedAt: 'asc' },
      select: { id: true },
    });
    if (oldest) {
      await this.prisma.turmaMember.update({
        where: { id: oldest.id },
        data: { role: TurmaRole.DELEGADO },
      });
    }
  }
}
