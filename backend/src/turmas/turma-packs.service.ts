import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';
import { TurmaAccessService } from './turma-access.service';
import { MAX_PACKS_PER_TURMA, turmaPath } from './turmas.constants';

export interface TurmaPackSummary {
  id: string;
  packId: string;
  name: string;
  code: string;
  itemCount: number;
  ownerName: string | null;
  sharedById: string;
  createdAt: string;
}

// Pacotes de tasks partilhados com a turma. So o dono do pacote o pode
// partilhar; qualquer membro ve e importa pelo fluxo normal (/packs/:code),
// por isso o codigo vai na resposta (quem e membro ja o podia receber).
@Injectable()
export class TurmaPacksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: TurmaAccessService,
    private readonly push: PushService,
  ) {}

  async list(userId: string, turmaId: string): Promise<TurmaPackSummary[]> {
    await this.access.requireMember(userId, turmaId);
    const rows = await this.prisma.turmaPack.findMany({
      where: { turmaId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        sharedById: true,
        createdAt: true,
        pack: {
          select: {
            id: true,
            name: true,
            code: true,
            owner: { select: { name: true } },
            _count: { select: { items: true } },
          },
        },
      },
    });
    return rows.map((row) => ({
      id: row.id,
      packId: row.pack.id,
      name: row.pack.name,
      code: row.pack.code,
      itemCount: row.pack._count.items,
      ownerName: row.pack.owner.name,
      sharedById: row.sharedById,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async share(userId: string, turmaId: string, packId: string) {
    const { turma } = await this.access.requireMember(userId, turmaId);
    // Pacote de outra pessoa = 404, igual a um que nao existe.
    const pack = await this.prisma.taskPack.findFirst({
      where: { id: packId, ownerId: userId },
      select: { id: true, name: true },
    });
    if (!pack) throw new NotFoundException('Task pack not found.');

    const already = await this.prisma.turmaPack.findUnique({
      where: { turmaId_packId: { turmaId, packId } },
      select: { id: true },
    });
    if (already) return already;

    const count = await this.prisma.turmaPack.count({ where: { turmaId } });
    if (count >= MAX_PACKS_PER_TURMA) {
      throw new BadRequestException(
        `A turma can have at most ${MAX_PACKS_PER_TURMA} task packs.`,
      );
    }
    const created = await this.prisma.turmaPack.create({
      data: { turmaId, packId, sharedById: userId },
      select: { id: true },
    });

    const members = await this.prisma.turmaMember.findMany({
      where: { turmaId, userId: { not: userId } },
      select: { userId: true },
    });
    // notifyUser nunca lanca: um aviso falhado nao parte a partilha.
    for (const member of members) {
      void this.push.notifyUser(member.userId, 'turmaPackShared', {
        name: turma.name,
        title: pack.name,
        url: `${turmaPath(turmaId)}?tab=packs`,
      });
    }
    return created;
  }

  // Quem partilhou ou o delegado. O pacote em si continua a existir.
  async unshare(userId: string, turmaId: string, linkId: string) {
    const membership = await this.access.requireMember(userId, turmaId);
    const link = await this.prisma.turmaPack.findFirst({
      where: { id: linkId, turmaId },
      select: { id: true, sharedById: true },
    });
    if (!link) throw new NotFoundException('Task pack not found.');
    this.access.assertDelegadoOrAuthor(membership, userId, link.sharedById);
    await this.prisma.turmaPack.delete({ where: { id: link.id } });
    return { deleted: true };
  }
}
