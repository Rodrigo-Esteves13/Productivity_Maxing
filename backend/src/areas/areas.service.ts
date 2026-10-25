import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { CreateAreaDto } from './dto/create-area.dto';
import { UpdateAreaDto } from './dto/update-area.dto';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { accessibleAreaWhere } from './area-access';

const AREA_INCLUDE = { defaultTaskType: { select: { key: true } } } as const;

type AreaRow = Prisma.AreaGetPayload<{ include: typeof AREA_INCLUDE }>;

/** Máximo de Areas privadas por user (trava abuso/spam de linhas). */
export const MAX_PRIVATE_AREAS_PER_USER = 50;
/** Máximo de propostas pendentes ao mesmo tempo por user. */
export const MAX_PENDING_PROPOSALS_PER_USER = 5;
/** Código do 409 ao apagar uma Area que ainda tem dados (ver remove()). */
export const AREA_IN_USE_CODE = 'AREA_IN_USE';

@Injectable()
export class AreasService {
  constructor(private readonly prisma: PrismaService) {}

  // Traduz a "key" vinda do frontend (ex: "ACADEMICO") para o id real na BD,
  // igual ao resolveTypes() do tasks.service.ts - mesma convenção em toda a
  // app: o frontend nunca fala em UUIDs de TaskType, só em keys estáveis.
  private async resolveDefaultTaskTypeId(
    key: string | null | undefined,
  ): Promise<string | null | undefined> {
    if (key === undefined) return undefined; // não mexer no campo
    if (key === null) return null; // desassociar explicitamente

    const taskType = await this.prisma.taskType.findUnique({ where: { key } });
    if (!taskType || !taskType.isActive) {
      throw new BadRequestException(`Task type "${key}" invalid or inactive.`);
    }
    return taskType.id;
  }

  // Nunca devolve ownerId (nem o de ninguém): o cliente só precisa de saber
  // se a Area é oficial ou sua. O motivo de recusa só vai para o dono.
  private toResponse(area: AreaRow, viewerId: string) {
    const { defaultTaskType, ownerId, proposalReviewNote, ...rest } = area;
    const isMine = ownerId === viewerId;
    return {
      ...rest,
      defaultTaskType: defaultTaskType?.key ?? null,
      isOfficial: ownerId === null,
      isMine,
      proposalReviewNote: isMine ? proposalReviewNote : null,
    };
  }

  private isAdmin(user: AuthenticatedUser): boolean {
    return user.role === (Role.ADMIN as string);
  }

  /**
   * Carrega uma Area que o user pode GERIR (editar/apagar/propor):
   * - oficial: só ADMIN;
   * - privada: só o dono (o admin NÃO gere privadas dos outros, só revê
   *   propostas).
   * Privada de outro user = 404, igual a "não existe".
   */
  private async findManageableOrThrow(user: AuthenticatedUser, id: string) {
    const area = await this.prisma.area.findUnique({ where: { id } });
    if (!area) throw new NotFoundException('Area not found.');

    if (area.ownerId === null) {
      if (!this.isAdmin(user)) {
        throw new ForbiddenException(
          'Official areas can only be managed by administrators.',
        );
      }
      return area;
    }
    if (area.ownerId !== user.id)
      throw new NotFoundException('Area not found.');
    return area;
  }

  private async assertOfficialNameFree(name: string, exceptId?: string) {
    const clash = await this.prisma.area.findFirst({
      where: {
        ownerId: null,
        name: { equals: name.trim(), mode: 'insensitive' },
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
      select: { id: true },
    });
    if (clash) {
      throw new ConflictException(
        'An official area with this name already exists.',
      );
    }
  }

  // --- Criar ---

  /** Qualquer user autenticado: cria uma Area PRIVADA sua. */
  async create(userId: string, dto: CreateAreaDto) {
    const count = await this.prisma.area.count({ where: { ownerId: userId } });
    if (count >= MAX_PRIVATE_AREAS_PER_USER) {
      throw new BadRequestException(
        `You can have at most ${MAX_PRIVATE_AREAS_PER_USER} personal areas.`,
      );
    }
    const { defaultTaskType, name, ...rest } = dto;
    const defaultTaskTypeId =
      await this.resolveDefaultTaskTypeId(defaultTaskType);

    const area = await this.prisma.area.create({
      data: {
        ...rest,
        name: name.trim(),
        defaultTaskTypeId: defaultTaskTypeId ?? null,
        ownerId: userId,
      },
      include: AREA_INCLUDE,
    });
    return this.toResponse(area, userId);
  }

  /** Só ADMIN (garantido no controller): cria uma Area OFICIAL. */
  async createOfficial(adminId: string, dto: CreateAreaDto) {
    const { defaultTaskType, name, ...rest } = dto;
    await this.assertOfficialNameFree(name);
    const defaultTaskTypeId =
      await this.resolveDefaultTaskTypeId(defaultTaskType);

    const area = await this.prisma.area.create({
      data: {
        ...rest,
        name: name.trim(),
        defaultTaskTypeId: defaultTaskTypeId ?? null,
        ownerId: null,
      },
      include: AREA_INCLUDE,
    });
    return this.toResponse(area, adminId);
  }

  // --- Ler ---

  // periodId nunca filtra o catálogo (uma cadeira pode ser real e atual
  // mesmo sem task nenhuma ainda). Quando vem um periodId concreto, cada
  // Area é só ANOTADA com usedInPeriod - o Notebook usa isto para agrupar/
  // ordenar, nunca para esconder. Devolve as oficiais + as privadas DO USER.
  async findAll(userId: string, periodId?: string, includeHidden = false) {
    const [areas, hiddenRows] = await Promise.all([
      this.prisma.area.findMany({
        where: accessibleAreaWhere(userId),
        include: AREA_INCLUDE,
        orderBy: [{ name: 'asc' }],
      }),
      this.prisma.areaHidden.findMany({
        where: { userId },
        select: { areaId: true },
      }),
    ]);
    const hidden = new Set(hiddenRows.map((h) => h.areaId));

    // Uma Area desligada some dos seletores - EXCETO se o user já a usa
    // (tasks ou notas), senão essas tasks ficavam com a Area em branco.
    let inUse = new Set<string>();
    if (!includeHidden && hidden.size > 0) {
      const ids = [...hidden];
      const [taskRows, noteRows] = await Promise.all([
        this.prisma.task.findMany({
          where: { userId, areaId: { in: ids } },
          select: { areaId: true },
          distinct: ['areaId'],
        }),
        this.prisma.notebookEntry.findMany({
          where: { userId, areaId: { in: ids } },
          select: { areaId: true },
          distinct: ['areaId'],
        }),
      ]);
      inUse = new Set([...taskRows, ...noteRows].map((r) => r.areaId));
    }

    const responses = areas
      .filter((a) => includeHidden || !hidden.has(a.id) || inUse.has(a.id))
      .map((a) => ({
        ...this.toResponse(a, userId),
        isHidden: hidden.has(a.id),
      }));

    if (!periodId || periodId === 'all') return responses;

    const usedAreaIds = new Set(
      (
        await this.prisma.task.findMany({
          where: { userId, periodId },
          select: { areaId: true },
          distinct: ['areaId'],
        })
      ).map((t) => t.areaId),
    );
    return responses.map((a) => ({
      ...a,
      usedInPeriod: usedAreaIds.has(a.id),
    }));
  }

  async findOne(userId: string, id: string) {
    const area = await this.prisma.area.findFirst({
      where: { id, ...accessibleAreaWhere(userId) },
      include: AREA_INCLUDE,
    });
    return area ? this.toResponse(area, userId) : null;
  }

  // --- Editar / apagar ---

  async update(user: AuthenticatedUser, id: string, dto: UpdateAreaDto) {
    const existing = await this.findManageableOrThrow(user, id);

    // Enquanto o admin pode estar a rever, o conteúdo não muda por baixo
    // dele (senão aprovava-se algo diferente do que foi lido).
    if (existing.proposalStatus === 'PENDING') {
      throw new ConflictException(
        'This area is waiting for review. Withdraw the proposal to edit it.',
      );
    }

    const { defaultTaskType, name, ...rest } = dto;
    if (name !== undefined && existing.ownerId === null) {
      await this.assertOfficialNameFree(name, id);
    }
    const defaultTaskTypeId =
      await this.resolveDefaultTaskTypeId(defaultTaskType);

    const area = await this.prisma.area.update({
      where: { id },
      data: {
        ...rest,
        ...(name !== undefined ? { name: name.trim() } : {}),
        ...(defaultTaskTypeId !== undefined ? { defaultTaskTypeId } : {}),
      },
      include: AREA_INCLUDE,
    });
    return this.toResponse(area, user.id);
  }

  async remove(user: AuthenticatedUser, id: string): Promise<void> {
    await this.findManageableOrThrow(user, id);

    // Task.area é Restrict: sem isto, o delete rebentava com um erro de FK
    // do Prisma (500). NotebookEntry e GradeComponent são onDelete: Cascade
    // (schema.prisma): apagar a Area apagava em silêncio as notas do caderno
    // e os componentes/entradas de nota. Contamos as três sem filtro de user
    // (numa Area oficial contam as de TODOS os users) e recusamos com 409 e
    // um código estável que o frontend traduz, com os números.
    const [tasks, notebookEntries, gradeComponents] = await Promise.all([
      this.prisma.task.count({ where: { areaId: id } }),
      this.prisma.notebookEntry.count({ where: { areaId: id } }),
      this.prisma.gradeComponent.count({ where: { areaId: id } }),
    ]);
    if (tasks + notebookEntries + gradeComponents > 0) {
      throw new ConflictException({
        code: AREA_IN_USE_CODE,
        message:
          'This area still has tasks, notebook notes or grade components. Move or delete them first.',
        counts: { tasks, notebookEntries, gradeComponents },
      });
    }
    await this.prisma.area.delete({ where: { id } });
  }

  // --- Desligar/ligar Areas oficiais (por user) ---

  /** Liga/desliga UMA Area oficial só para este user. */
  async setHidden(userId: string, areaId: string, hidden: boolean) {
    const area = await this.prisma.area.findFirst({
      where: { id: areaId, ownerId: null },
      select: { id: true },
    });
    // Só oficiais: as pessoais apagam-se, e a de outro user nem existe aqui.
    if (!area) throw new NotFoundException('Official area not found.');

    if (hidden) {
      await this.prisma.areaHidden.upsert({
        where: { userId_areaId: { userId, areaId } },
        create: { userId, areaId },
        update: {},
      });
    } else {
      await this.prisma.areaHidden.deleteMany({ where: { userId, areaId } });
    }
    return { areaId, isHidden: hidden };
  }

  /** Liga/desliga TODAS as oficiais de uma vez. */
  async setAllOfficialHidden(userId: string, hidden: boolean) {
    if (hidden) {
      const official = await this.prisma.area.findMany({
        where: { ownerId: null },
        select: { id: true },
      });
      await this.prisma.areaHidden.createMany({
        data: official.map((a) => ({ userId, areaId: a.id })),
        skipDuplicates: true,
      });
    } else {
      await this.prisma.areaHidden.deleteMany({ where: { userId } });
    }
    return { isHidden: hidden };
  }

  // --- Proposta de oficialização ---

  async propose(userId: string, id: string) {
    const area = await this.prisma.area.findFirst({
      where: { id, ownerId: userId },
    });
    // Oficial ou de outro user: tudo "não encontrada".
    if (!area) throw new NotFoundException('Area not found.');
    if (area.proposalStatus === 'PENDING') {
      throw new ConflictException('This area was already proposed.');
    }

    const pending = await this.prisma.area.count({
      where: { ownerId: userId, proposalStatus: 'PENDING' },
    });
    if (pending >= MAX_PENDING_PROPOSALS_PER_USER) {
      throw new BadRequestException(
        `You can have at most ${MAX_PENDING_PROPOSALS_PER_USER} proposals waiting for review.`,
      );
    }

    // updateMany com a condição no WHERE: dois cliques simultâneos não
    // criam dois estados inconsistentes.
    const result = await this.prisma.area.updateMany({
      where: {
        id,
        ownerId: userId,
        proposalStatus: { in: ['NONE', 'REJECTED'] },
      },
      data: {
        proposalStatus: 'PENDING',
        proposedAt: new Date(),
        proposalReviewNote: null,
      },
    });
    if (result.count === 0) {
      throw new ConflictException('This area was already proposed.');
    }
    return this.reloadFor(userId, id);
  }

  async withdraw(userId: string, id: string) {
    const result = await this.prisma.area.updateMany({
      where: { id, ownerId: userId, proposalStatus: 'PENDING' },
      data: { proposalStatus: 'NONE', proposedAt: null },
    });
    if (result.count === 0) {
      throw new NotFoundException('No pending proposal for this area.');
    }
    return this.reloadFor(userId, id);
  }

  /** ADMIN: fila de propostas, as mais antigas primeiro. */
  async listProposals() {
    const rows = await this.prisma.area.findMany({
      where: { ownerId: { not: null }, proposalStatus: 'PENDING' },
      include: {
        ...AREA_INCLUDE,
        // Só o nome de quem propôs - o admin não precisa de mais do que isto
        // para decidir, e o email de um user não tem de andar em listas.
        owner: { select: { name: true } },
      },
      orderBy: { proposedAt: 'asc' },
    });
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      colorHex: r.colorHex,
      credits: r.credits,
      defaultTaskType: r.defaultTaskType?.key ?? null,
      proposedAt: r.proposedAt,
      proposedBy: r.owner?.name ?? null,
    }));
  }

  /** ADMIN: aprova - a Area passa a oficial (ownerId = null). */
  async approve(adminId: string, id: string) {
    const area = await this.prisma.area.findFirst({
      where: { id, ownerId: { not: null }, proposalStatus: 'PENDING' },
    });
    if (!area) throw new NotFoundException('Proposal not found.');
    await this.assertOfficialNameFree(area.name);

    // Condição repetida no WHERE: se o dono retirou a proposta (ou outro
    // admin decidiu) entre o findFirst e aqui, não aprova nada.
    const result = await this.prisma.area.updateMany({
      where: { id, ownerId: { not: null }, proposalStatus: 'PENDING' },
      data: {
        ownerId: null,
        proposalStatus: 'NONE',
        proposedAt: null,
        proposalReviewNote: null,
      },
    });
    if (result.count === 0) throw new NotFoundException('Proposal not found.');
    return this.reloadFor(adminId, id);
  }

  /** ADMIN: recusa - fica privada do dono, com o motivo (opcional). */
  async reject(id: string, note?: string) {
    const result = await this.prisma.area.updateMany({
      where: { id, ownerId: { not: null }, proposalStatus: 'PENDING' },
      data: {
        proposalStatus: 'REJECTED',
        proposedAt: null,
        proposalReviewNote: note?.trim() || null,
      },
    });
    if (result.count === 0) throw new NotFoundException('Proposal not found.');
    return { id, proposalStatus: 'REJECTED' as const };
  }

  private async reloadFor(viewerId: string, id: string) {
    const area = await this.prisma.area.findUniqueOrThrow({
      where: { id },
      include: AREA_INCLUDE,
    });
    return this.toResponse(area, viewerId);
  }
}
