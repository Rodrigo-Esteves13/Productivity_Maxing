import { pushDisplayName } from '../common/display-name.util';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';
import { SocialService } from '../social/social.service';
import { NotebookService, type SharedEntryResult } from './notebook.service';
import { SOCIAL_REQUESTS_PATH } from '../common/app-links.util';

export interface OwnerAreaOption {
  areaId: string;
  name: string;
  colorHex: string | null;
  entryCount: number;
}

export interface IncomingGrant {
  grantId: string;
  viewerId: string;
  viewerName: string | null;
  viewerAvatarUrl: string | null;
  status: 'PENDING' | 'APPROVED';
  areaIds: string[];
  createdAt: string;
}

export interface IncomingGrantsView {
  /** Cadeiras com notas MINHAS que posso dar a ler (para o seletor). */
  areas: OwnerAreaOption[];
  grants: IncomingGrant[];
}

export interface OutgoingGrant {
  grantId: string;
  ownerId: string;
  ownerName: string | null;
  /** DENIED aparece como PENDING: quem pede nao fica a saber que foi recusado. */
  status: 'PENDING' | 'APPROVED';
  areaCount: number;
}

export interface FriendNoteListItem {
  id: string;
  title: string;
  entryType: string;
  classNumber: number | null;
  date: string;
  areaId: string;
  areaName: string;
  areaColor: string | null;
}

export interface FriendNotesList {
  ownerName: string | null;
  entries: FriendNoteListItem[];
}

const MAX_LIST = 300;

@Injectable()
export class NotebookViewGrantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly social: SocialService,
    private readonly notebook: NotebookService,
    private readonly push: PushService,
  ) {}

  /** Pedir para ler as notas de um amigo. So entre amigos; idempotente. */
  async request(
    viewerId: string,
    ownerId: string,
  ): Promise<{ status: 'PENDING' | 'APPROVED' }> {
    if (
      viewerId === ownerId ||
      !(await this.social.areFriends(viewerId, ownerId))
    ) {
      throw new NotFoundException();
    }
    const existing = await this.prisma.notebookViewGrant.findUnique({
      where: { ownerId_viewerId: { ownerId, viewerId } },
    });
    if (existing) {
      // DENIED nao muda nem volta a notificar (sem spam, sem revelar a recusa).
      return {
        status: existing.status === 'APPROVED' ? 'APPROVED' : 'PENDING',
      };
    }
    await this.prisma.notebookViewGrant.create({ data: { ownerId, viewerId } });
    const viewer = await this.prisma.user.findUnique({
      where: { id: viewerId },
      select: { name: true, email: true },
    });
    // Cancelar e voltar a pedir nao volta a apitar no mesmo dia.
    void this.push.notifyUserOnce(
      ownerId,
      'notesRequested',
      { name: pushDisplayName(viewer), url: SOCIAL_REQUESTS_PATH },
      `notesRequested:${ownerId}:${viewerId}`,
    );
    return { status: 'PENDING' };
  }

  private async ownerAreas(ownerId: string): Promise<OwnerAreaOption[]> {
    const groups = await this.prisma.notebookEntry.groupBy({
      by: ['areaId'],
      where: { userId: ownerId, privateFromFriends: false },
      _count: { _all: true },
    });
    if (groups.length === 0) return [];
    const areas = await this.prisma.area.findMany({
      where: { id: { in: groups.map((g) => g.areaId) } },
      select: { id: true, name: true, colorHex: true },
    });
    const counts = new Map(groups.map((g) => [g.areaId, g._count._all]));
    return areas
      .map((a) => ({
        areaId: a.id,
        name: a.name,
        colorHex: a.colorHex,
        entryCount: counts.get(a.id) ?? 0,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async incoming(ownerId: string): Promise<IncomingGrantsView> {
    const [areas, rows] = await Promise.all([
      this.ownerAreas(ownerId),
      this.prisma.notebookViewGrant.findMany({
        where: { ownerId, status: { in: ['PENDING', 'APPROVED'] } },
        orderBy: { createdAt: 'desc' },
        take: 200,
        include: { viewer: { select: { name: true, avatarUrl: true } } },
      }),
    ]);
    return {
      areas,
      grants: rows.map((r) => ({
        grantId: r.id,
        viewerId: r.viewerId,
        viewerName: r.viewer.name,
        viewerAvatarUrl: r.viewer.avatarUrl,
        status: r.status === 'APPROVED' ? 'APPROVED' : 'PENDING',
        areaIds: r.areaIds,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  }

  /** Cadeiras escolhidas tem de ser MINHAS (com notas) - nunca confiar nos ids do cliente. */
  private async validateAreas(
    ownerId: string,
    areaIds: string[],
  ): Promise<string[]> {
    const allowed = new Set(
      (await this.ownerAreas(ownerId)).map((a) => a.areaId),
    );
    if (areaIds.length === 0 || areaIds.some((id) => !allowed.has(id))) {
      throw new BadRequestException('Choose at least one of your subjects.');
    }
    return [...new Set(areaIds)];
  }

  async decide(
    ownerId: string,
    grantId: string,
    approve: boolean,
    areaIds: string[] | undefined,
  ): Promise<void> {
    const grant = await this.prisma.notebookViewGrant.findFirst({
      where: { id: grantId, ownerId },
    });
    if (!grant) throw new NotFoundException();
    if (!approve) {
      await this.prisma.notebookViewGrant.update({
        where: { id: grantId },
        data: { status: 'DENIED', areaIds: [], decidedAt: new Date() },
      });
      return;
    }
    const valid = await this.validateAreas(ownerId, areaIds ?? []);
    await this.prisma.notebookViewGrant.update({
      where: { id: grantId },
      data: { status: 'APPROVED', areaIds: valid, decidedAt: new Date() },
    });
    if (grant.status !== 'APPROVED') {
      const owner = await this.prisma.user.findUnique({
        where: { id: ownerId },
        select: { name: true, email: true },
      });
      void this.push.notifyUser(grant.viewerId, 'notesGranted', {
        name: pushDisplayName(owner),
        url: `/social/notes/${ownerId}`,
      });
    }
  }

  /** O dono muda as cadeiras de quem ja tem acesso. */
  async updateAreas(
    ownerId: string,
    grantId: string,
    areaIds: string[],
  ): Promise<void> {
    const valid = await this.validateAreas(ownerId, areaIds);
    const res = await this.prisma.notebookViewGrant.updateMany({
      where: { id: grantId, ownerId, status: 'APPROVED' },
      data: { areaIds: valid },
    });
    if (res.count === 0) throw new NotFoundException();
  }

  /**
   * Dono revoga/apaga, ou quem pediu cancela/desiste. Quem pediu NAO pode
   * apagar uma recusa: senao apagava-a e voltava a pedir (e a notificar o
   * dono) em ciclo, contornando o "recusado nao volta a apitar".
   */
  async remove(userId: string, grantId: string): Promise<void> {
    const res = await this.prisma.notebookViewGrant.deleteMany({
      where: {
        id: grantId,
        OR: [
          { ownerId: userId },
          { viewerId: userId, status: { not: 'DENIED' } },
        ],
      },
    });
    if (res.count === 0) throw new NotFoundException();
  }

  async outgoing(viewerId: string): Promise<OutgoingGrant[]> {
    const rows = await this.prisma.notebookViewGrant.findMany({
      where: { viewerId },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { owner: { select: { name: true } } },
    });
    return rows.map((r) => ({
      grantId: r.id,
      ownerId: r.ownerId,
      ownerName: r.owner.name,
      status: r.status === 'APPROVED' ? 'APPROVED' : 'PENDING',
      areaCount: r.status === 'APPROVED' ? r.areaIds.length : 0,
    }));
  }

  /**
   * Verificacao central, refeita em CADA leitura: concessao aprovada E ainda
   * amigos (remover/bloquear corta o acesso de imediato). Devolve as cadeiras
   * permitidas; qualquer falha = 404 igual, para nao revelar nada.
   */
  private async allowedAreas(
    viewerId: string,
    ownerId: string,
  ): Promise<string[]> {
    const grant = await this.prisma.notebookViewGrant.findUnique({
      where: { ownerId_viewerId: { ownerId, viewerId } },
    });
    if (
      !grant ||
      grant.status !== 'APPROVED' ||
      grant.areaIds.length === 0 ||
      !(await this.social.areFriends(viewerId, ownerId))
    ) {
      throw new NotFoundException();
    }
    return grant.areaIds;
  }

  async listFor(viewerId: string, ownerId: string): Promise<FriendNotesList> {
    const areaIds = await this.allowedAreas(viewerId, ownerId);
    const [owner, entries] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: ownerId },
        select: { name: true },
      }),
      this.prisma.notebookEntry.findMany({
        where: {
          userId: ownerId,
          areaId: { in: areaIds },
          privateFromFriends: false,
        },
        orderBy: { date: 'desc' },
        take: MAX_LIST,
        select: {
          id: true,
          title: true,
          entryType: true,
          classNumber: true,
          date: true,
          areaId: true,
          area: { select: { name: true, colorHex: true } },
        },
      }),
    ]);
    return {
      ownerName: owner?.name ?? null,
      entries: entries.map((e) => ({
        id: e.id,
        title: e.title,
        entryType: e.entryType,
        classNumber: e.classNumber,
        date: e.date.toISOString(),
        areaId: e.areaId,
        areaName: e.area.name,
        areaColor: e.area.colorHex,
      })),
    };
  }

  async getEntryFor(
    viewerId: string,
    ownerId: string,
    entryId: string,
  ): Promise<SharedEntryResult> {
    const areaIds = await this.allowedAreas(viewerId, ownerId);
    const entry = await this.prisma.notebookEntry.findFirst({
      // Entrada privada = 404, igual a uma que nao existe (sem enumeracao).
      where: {
        id: entryId,
        userId: ownerId,
        areaId: { in: areaIds },
        privateFromFriends: false,
      },
      include: {
        area: { select: { name: true, colorHex: true } },
        photos: { orderBy: { position: 'asc' } },
        attachments: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!entry) throw new NotFoundException();
    // So chega aqui quem e amigo (allowedAreas): pode ver quem e o dono.
    const owner = await this.prisma.user.findUnique({
      where: { id: ownerId },
      select: { id: true, name: true, avatarUrl: true },
    });
    return {
      status: 'ok',
      role: 'VIEWER',
      hasPendingProposal: false,
      context: {
        ownEntryId: null,
        owner: owner
          ? { userId: owner.id, name: owner.name, avatarUrl: owner.avatarUrl }
          : null,
      },
      entry: await this.notebook.buildSharedEntryView(entry),
    };
  }
}
