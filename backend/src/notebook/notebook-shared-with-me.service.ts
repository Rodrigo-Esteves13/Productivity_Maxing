import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type SharedWithMeStatus = 'APPROVED' | 'PENDING' | 'DENIED' | 'PUBLIC';
export type SharedWithMeRole = 'VIEWER' | 'EDITOR' | 'CO_OWNER';

export interface SharedWithMeItem {
  token: string;
  status: SharedWithMeStatus;
  role: SharedWithMeRole;
  /** null enquanto o acesso nao esta aprovado: nao se revela conteudo/metadados. */
  title: string | null;
  areaName: string | null;
  areaColor: string | null;
  ownerName: string | null;
  lastActivityAt: string;
}

const MAX_ITEMS = 100;

@Injectable()
export class NotebookSharedWithMeService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Aulas que OUTRAS pessoas partilharam comigo: pedidos de acesso meus
   * (qualquer estado) + partilhas publicas que abri com sessao. Nunca inclui
   * as minhas proprias partilhas. Metadados (titulo, cadeira, dono) so saem
   * quando o acesso esta aprovado ou e publico - um pedido pendente/recusado
   * mostra apenas o estado, para a lista nao ser um atalho para ver o que o
   * dono nao aprovou.
   */
  async list(userId: string): Promise<SharedWithMeItem[]> {
    const shareSelect = {
      token: true,
      visibility: true,
      createdByUserId: true,
      createdBy: { select: { name: true } },
      notebookEntry: {
        select: {
          title: true,
          area: { select: { name: true, colorHex: true } },
        },
      },
    } as const;

    const [requests, visits] = await Promise.all([
      this.prisma.notebookShareAccessRequest.findMany({
        where: {
          requestingUserId: userId,
          notebookShare: { createdByUserId: { not: userId } },
        },
        orderBy: { createdAt: 'desc' },
        take: MAX_ITEMS,
        select: {
          status: true,
          accessRole: true,
          createdAt: true,
          decidedAt: true,
          notebookShare: { select: shareSelect },
        },
      }),
      this.prisma.shareVisit.findMany({
        where: {
          viewerUserId: userId,
          notebookShare: {
            visibility: 'PUBLIC',
            createdByUserId: { not: userId },
          },
        },
        orderBy: { lastVisitAt: 'desc' },
        take: MAX_ITEMS,
        select: {
          lastVisitAt: true,
          notebookShare: { select: shareSelect },
        },
      }),
    ]);

    const items = new Map<string, SharedWithMeItem>();

    for (const r of requests) {
      const share = r.notebookShare;
      const visible = r.status === 'APPROVED';
      items.set(share.token, {
        token: share.token,
        status: r.status,
        role: r.accessRole,
        title: visible ? share.notebookEntry.title : null,
        areaName: visible ? share.notebookEntry.area.name : null,
        areaColor: visible ? share.notebookEntry.area.colorHex : null,
        ownerName: visible ? share.createdBy.name : null,
        lastActivityAt: (r.decidedAt ?? r.createdAt).toISOString(),
      });
    }

    for (const v of visits) {
      const share = v.notebookShare;
      if (items.has(share.token)) continue;
      items.set(share.token, {
        token: share.token,
        status: 'PUBLIC',
        role: 'VIEWER',
        title: share.notebookEntry.title,
        areaName: share.notebookEntry.area.name,
        areaColor: share.notebookEntry.area.colorHex,
        ownerName: share.createdBy.name,
        lastActivityAt: v.lastVisitAt.toISOString(),
      });
    }

    return [...items.values()]
      .sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt))
      .slice(0, MAX_ITEMS);
  }
}
