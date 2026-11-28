import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotebookService } from '../notebook/notebook.service';
import { assertAreaAccessible } from '../areas/area-access';
import { TurmaAccessService } from './turma-access.service';
import {
  LINKED_ENTRIES_PAGE_SIZE,
  MAX_LINKED_AREAS_PER_MEMBER,
} from './turmas.constants';

const entryCountKey = (userId: string, areaId: string) => `${userId}|${areaId}`;

// Cadeiras do caderno que um membro publica na turma. Os outros membros leem
// as entradas (nunca as privadas: privateFromFriends), sem editar.
@Injectable()
export class TurmaLinkedAreasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: TurmaAccessService,
    private readonly notebook: NotebookService,
  ) {}

  async list(userId: string, turmaId: string) {
    await this.access.requireMember(userId, turmaId);
    const links = await this.prisma.turmaLinkedArea.findMany({
      where: { turmaId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        userId: true,
        areaId: true,
        user: { select: { name: true } },
        area: { select: { name: true, colorHex: true } },
      },
    });
    const counts = await this.countEntriesPerLink(links);
    return links.map((link) => ({
      id: link.id,
      userId: link.userId,
      ownerName: link.user.name,
      areaId: link.areaId,
      areaName: link.area.name,
      areaColor: link.area.colorHex,
      entryCount: counts.get(entryCountKey(link.userId, link.areaId)) ?? 0,
    }));
  }

  /** Um so groupBy para todas as cadeiras partilhadas (so entradas nao privadas). */
  private async countEntriesPerLink(
    links: { userId: string; areaId: string }[],
  ): Promise<Map<string, number>> {
    if (links.length === 0) return new Map();
    const rows = await this.prisma.notebookEntry.groupBy({
      by: ['userId', 'areaId'],
      where: {
        privateFromFriends: false,
        OR: links.map((link) => ({
          userId: link.userId,
          areaId: link.areaId,
        })),
      },
      _count: { _all: true },
    });
    return new Map(
      rows.map((row) => [
        entryCountKey(row.userId, row.areaId),
        row._count._all,
      ]),
    );
  }

  async link(userId: string, turmaId: string, areaId: string) {
    await this.access.requireMember(userId, turmaId);
    await assertAreaAccessible(this.prisma, userId, areaId);
    const where = { turmaId_userId_areaId: { turmaId, userId, areaId } };
    // Religar uma cadeira ja partilhada nao ocupa lugar: o teto so conta
    // para ligacoes novas.
    const existing = await this.prisma.turmaLinkedArea.findUnique({
      where,
      select: { id: true },
    });
    if (existing) return existing;
    const count = await this.prisma.turmaLinkedArea.count({
      where: { turmaId, userId },
    });
    if (count >= MAX_LINKED_AREAS_PER_MEMBER) {
      throw new BadRequestException(
        `You can share at most ${MAX_LINKED_AREAS_PER_MEMBER} subjects in a turma.`,
      );
    }
    return this.prisma.turmaLinkedArea.upsert({
      where,
      create: { turmaId, userId, areaId },
      update: {},
      select: { id: true },
    });
  }

  async unlink(userId: string, turmaId: string, linkId: string) {
    const membership = await this.access.requireMember(userId, turmaId);
    const link = await this.findLinkOrThrow(turmaId, linkId);
    this.access.assertDelegadoOrAuthor(membership, userId, link.userId);
    await this.prisma.turmaLinkedArea.delete({ where: { id: link.id } });
    return { deleted: true };
  }

  async listEntries(userId: string, turmaId: string, linkId: string) {
    await this.access.requireMember(userId, turmaId);
    const link = await this.findLinkOrThrow(turmaId, linkId);
    const entries = await this.prisma.notebookEntry.findMany({
      where: {
        userId: link.userId,
        areaId: link.areaId,
        privateFromFriends: false,
      },
      orderBy: { date: 'desc' },
      take: LINKED_ENTRIES_PAGE_SIZE,
      select: {
        id: true,
        title: true,
        entryType: true,
        classNumber: true,
        date: true,
      },
    });
    return entries.map((entry) => ({
      ...entry,
      date: entry.date.toISOString(),
    }));
  }

  async getEntry(
    userId: string,
    turmaId: string,
    linkId: string,
    entryId: string,
  ) {
    await this.access.requireMember(userId, turmaId);
    const link = await this.findLinkOrThrow(turmaId, linkId);
    // Entrada privada = 404, igual a uma que nao existe.
    const entry = await this.prisma.notebookEntry.findFirst({
      where: {
        id: entryId,
        userId: link.userId,
        areaId: link.areaId,
        privateFromFriends: false,
      },
      include: {
        area: { select: { name: true, colorHex: true } },
        photos: { orderBy: { position: 'asc' } },
        attachments: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!entry) throw new NotFoundException('Entry not found.');
    return {
      ownerName: link.user.name,
      entry: await this.notebook.buildSharedEntryView(entry),
    };
  }

  private async findLinkOrThrow(turmaId: string, linkId: string) {
    const link = await this.prisma.turmaLinkedArea.findFirst({
      where: { id: linkId, turmaId },
      select: {
        id: true,
        userId: true,
        areaId: true,
        user: { select: { name: true } },
      },
    });
    if (!link) throw new NotFoundException('Subject not found.');
    return link;
  }
}
