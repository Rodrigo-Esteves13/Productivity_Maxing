import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TurmaRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface TurmaMembership {
  role: TurmaRole;
  turma: { id: string; name: string; membersCanEditNotes: boolean };
}

// Toda a leitura e escrita numa turma passa por aqui. Quem nao e membro
// recebe 404, igual a uma turma que nao existe (sem enumeracao de ids).
@Injectable()
export class TurmaAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async requireMember(
    userId: string,
    turmaId: string,
  ): Promise<TurmaMembership> {
    const membership = await this.prisma.turmaMember.findUnique({
      where: { turmaId_userId: { turmaId, userId } },
      select: {
        role: true,
        turma: { select: { id: true, name: true, membersCanEditNotes: true } },
      },
    });
    if (!membership) throw new NotFoundException('Turma not found.');
    return membership;
  }

  async requireDelegado(
    userId: string,
    turmaId: string,
  ): Promise<TurmaMembership> {
    const membership = await this.requireMember(userId, turmaId);
    if (membership.role !== TurmaRole.DELEGADO) {
      throw new ForbiddenException('Only the delegado can do this.');
    }
    return membership;
  }

  // Delegado ou o autor do item (nota, ficheiro, cadeira publicada).
  assertDelegadoOrAuthor(
    membership: TurmaMembership,
    userId: string,
    authorId: string | null,
  ): void {
    if (membership.role === TurmaRole.DELEGADO || authorId === userId) return;
    throw new ForbiddenException(
      'Only the delegado or the author can do this.',
    );
  }

  canEditNotes(membership: TurmaMembership): boolean {
    return (
      membership.role === TurmaRole.DELEGADO ||
      membership.turma.membersCanEditNotes
    );
  }
}
