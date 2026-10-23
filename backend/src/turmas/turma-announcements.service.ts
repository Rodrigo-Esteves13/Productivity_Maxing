import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';
import { TurmaAccessService } from './turma-access.service';
import { CreateAnnouncementDto } from './dto/turma.dto';
import { ANNOUNCEMENTS_PAGE_SIZE, turmaPath } from './turmas.constants';

@Injectable()
export class TurmaAnnouncementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: TurmaAccessService,
    private readonly push: PushService,
  ) {}

  async list(userId: string, turmaId: string) {
    await this.access.requireMember(userId, turmaId);
    const rows = await this.prisma.turmaAnnouncement.findMany({
      where: { turmaId },
      orderBy: { createdAt: 'desc' },
      take: ANNOUNCEMENTS_PAGE_SIZE,
      select: {
        id: true,
        title: true,
        body: true,
        createdAt: true,
        author: { select: { name: true } },
      },
    });
    return rows.map(({ author, createdAt, ...row }) => ({
      ...row,
      createdAt: createdAt.toISOString(),
      authorName: author?.name ?? null,
    }));
  }

  async create(userId: string, turmaId: string, dto: CreateAnnouncementDto) {
    const { turma } = await this.access.requireDelegado(userId, turmaId);
    const announcement = await this.prisma.turmaAnnouncement.create({
      data: { turmaId, authorId: userId, title: dto.title, body: dto.body },
      select: { id: true },
    });
    const members = await this.prisma.turmaMember.findMany({
      where: { turmaId, userId: { not: userId } },
      select: { userId: true },
    });
    // notifyUser nunca lanca: um aviso falhado nao parte a publicacao.
    for (const member of members) {
      void this.push.notifyUser(member.userId, 'turmaAnnouncement', {
        name: turma.name,
        title: dto.title,
        url: turmaPath(turmaId),
      });
    }
    return announcement;
  }

  async remove(userId: string, turmaId: string, announcementId: string) {
    await this.access.requireDelegado(userId, turmaId);
    const { count } = await this.prisma.turmaAnnouncement.deleteMany({
      where: { id: announcementId, turmaId },
    });
    if (count === 0) throw new NotFoundException('Announcement not found.');
    return { deleted: true };
  }
}
