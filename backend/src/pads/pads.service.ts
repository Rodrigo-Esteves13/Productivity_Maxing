import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, SecurityEventType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SecurityLogsService } from '../security-logs/security-logs.service';
import { SavePadDto } from './dto/pad.dto';
import {
  ADMIN_PADS_PAGE_SIZE,
  ADMIN_PAD_PREVIEW_LENGTH,
  PAD_ANON_MAX_CONTENT_LENGTH,
  PAD_EXPIRY_MS,
} from './pads.constants';

// Quem fez o pedido de moderacao, para o security log.
export interface AdminRequestInfo {
  adminId: string;
  ip: string;
  method: string;
  path: string;
  userAgent?: string;
}

// Quem esta a ler/escrever: uma conta, ou ninguem (so o hash do IP).
export interface PadViewer {
  userId: string | null;
  ipHash: string | null;
}

// Sem nome de quem escreveu ou trancou: o pad e publico, mostrar quem
// editou expunha nomes a desconhecidos. So se diz se esta trancado e se
// foi quem pergunta que o trancou.
export interface PadView {
  slug: string;
  content: string;
  version: number;
  updatedAt: string | null;
  locked: boolean;
  lockedByMe: boolean;
  // Limite de caracteres que ESTE visitante pode gravar.
  maxLength: number | null;
}

const PAD_SELECT = {
  slug: true,
  content: true,
  version: true,
  updatedAt: true,
  lockedById: true,
} satisfies Prisma.PadSelect;

type PadRow = Prisma.PadGetPayload<{ select: typeof PAD_SELECT }>;

const UNIQUE_VIOLATION = 'P2002';

function toView(slug: string, pad: PadRow | null, viewer: PadViewer): PadView {
  const maxLength = viewer.userId ? null : PAD_ANON_MAX_CONTENT_LENGTH;
  if (!pad) {
    return {
      slug,
      content: '',
      version: 0,
      updatedAt: null,
      locked: false,
      lockedByMe: false,
      maxLength,
    };
  }
  const { lockedById, updatedAt, ...rest } = pad;
  return {
    ...rest,
    updatedAt: updatedAt.toISOString(),
    locked: lockedById !== null,
    lockedByMe: lockedById !== null && lockedById === viewer.userId,
    maxLength,
  };
}

@Injectable()
export class PadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly securityLogs: SecurityLogsService,
  ) {}

  // Um pad que ainda nao existe le-se como vazio (versao 0); so passa a
  // existir na primeira gravacao.
  async get(slug: string, viewer: PadViewer): Promise<PadView> {
    const pad = await this.prisma.pad.findUnique({
      where: { slug },
      select: PAD_SELECT,
    });
    return toView(slug, pad, viewer);
  }

  // Concorrencia otimista: so grava se ninguem gravou desde baseVersion.
  // Se alguem gravou, 409 com o pad atual para o cliente decidir.
  async save(
    viewer: PadViewer,
    slug: string,
    dto: SavePadDto,
  ): Promise<PadView> {
    if (!viewer.userId && (await this.isBlockedSource(viewer.ipHash))) {
      throw new ForbiddenException('You cannot edit pads without an account.');
    }
    if (!viewer.userId && dto.content.length > PAD_ANON_MAX_CONTENT_LENGTH) {
      throw new BadRequestException(
        `Without an account a pad can have at most ${PAD_ANON_MAX_CONTENT_LENGTH} characters.`,
      );
    }
    const saved =
      dto.baseVersion === 0
        ? await this.createFirst(viewer, slug, dto.content)
        : await this.updateFrom(viewer, slug, dto);
    if (saved) return saved;

    const current = await this.get(slug, viewer);
    if (current.locked && !current.lockedByMe) {
      throw new ForbiddenException('This pad is locked.');
    }
    throw new ConflictException({
      message: 'This pad was changed by someone else.',
      current,
    });
  }

  // Trancar: todos continuam a ler, so esta conta edita. Um pad que ainda
  // nao existe passa a existir (vazio) ja trancado.
  async lock(userId: string, slug: string): Promise<PadView> {
    const viewer = { userId, ipHash: null };
    const { count } = await this.prisma.pad.updateMany({
      where: { slug, lockedById: null },
      data: { lockedById: userId, lockedAt: new Date() },
    });
    if (count === 0) {
      const existing = await this.get(slug, viewer);
      if (existing.locked && !existing.lockedByMe) {
        throw new ForbiddenException('This pad is locked by someone else.');
      }
      if (!existing.locked) {
        try {
          await this.prisma.pad.create({
            data: {
              slug,
              version: 1,
              updatedById: userId,
              lockedById: userId,
              lockedAt: new Date(),
            },
          });
        } catch (err) {
          if (!this.isUniqueViolation(err)) throw err;
          // Alguem criou-o entretanto: tenta trancar outra vez.
          return this.lock(userId, slug);
        }
      }
    }
    return this.get(slug, viewer);
  }

  // Destrancar: quem trancou, ou um admin (moderacao).
  async unlock(userId: string, slug: string, isAdmin: boolean) {
    const { count } = await this.prisma.pad.updateMany({
      where: { slug, ...(isAdmin ? {} : { lockedById: userId }) },
      data: { lockedById: null, lockedAt: null },
    });
    if (count === 0) throw new NotFoundException('Pad not found.');
    return this.get(slug, { userId, ipHash: null });
  }

  // Chamado pelo cron (RemindersService.run): apaga pads sem edicoes ha
  // PAD_EXPIRY_DAYS. Os trancados ficam (tem dono com conta).
  async deleteExpired(now = new Date()): Promise<number> {
    const { count } = await this.prisma.pad.deleteMany({
      where: {
        lockedById: null,
        updatedAt: { lt: new Date(now.getTime() - PAD_EXPIRY_MS) },
      },
    });
    return count;
  }

  private async createFirst(
    viewer: PadViewer,
    slug: string,
    content: string,
  ): Promise<PadView | null> {
    try {
      const pad = await this.prisma.pad.create({
        data: { slug, content, version: 1, ...this.authorFields(viewer) },
        select: PAD_SELECT,
      });
      return toView(slug, pad, viewer);
    } catch (err) {
      if (this.isUniqueViolation(err)) return null;
      throw err;
    }
  }

  private async updateFrom(
    viewer: PadViewer,
    slug: string,
    dto: SavePadDto,
  ): Promise<PadView | null> {
    // Trancado por outra conta = nao grava (0 linhas, como um conflito; o
    // save distingue os dois casos a seguir).
    const lockFilter = viewer.userId
      ? { OR: [{ lockedById: null }, { lockedById: viewer.userId }] }
      : { lockedById: null };
    const { count } = await this.prisma.pad.updateMany({
      where: { slug, version: dto.baseVersion, ...lockFilter },
      data: {
        content: dto.content,
        version: { increment: 1 },
        ...this.authorFields(viewer),
      },
    });
    return count === 0 ? null : this.get(slug, viewer);
  }

  // Conta: guarda quem; sem conta: so o hash do IP.
  private authorFields(viewer: PadViewer) {
    return viewer.userId
      ? { updatedById: viewer.userId, updatedByIpHash: null }
      : { updatedById: null, updatedByIpHash: viewer.ipHash };
  }

  private isUniqueViolation(err: unknown): boolean {
    return (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === UNIQUE_VIOLATION
    );
  }

  // Moderacao: pads alterados mais recentemente, com quem gravou por ultimo
  // (conta ou hash do IP). So admins (o controller aplica o RolesGuard); os
  // utilizadores nunca veem quem editou um pad.
  async listRecentForAdmin() {
    const pads = await this.prisma.pad.findMany({
      orderBy: { updatedAt: 'desc' },
      take: ADMIN_PADS_PAGE_SIZE,
      select: {
        slug: true,
        content: true,
        updatedAt: true,
        updatedByIpHash: true,
        updatedBy: { select: { id: true, name: true, email: true } },
        lockedBy: { select: { id: true, name: true, email: true } },
      },
    });
    const hashes = pads
      .map((pad) => pad.updatedByIpHash)
      .filter((hash): hash is string => hash !== null);
    const blocked = new Set(
      (
        await this.prisma.padBlockedSource.findMany({
          where: { ipHash: { in: hashes } },
          select: { ipHash: true },
        })
      ).map((row) => row.ipHash),
    );
    return pads.map(({ content, updatedAt, ...pad }) => ({
      ...pad,
      sourceBlocked:
        pad.updatedByIpHash !== null && blocked.has(pad.updatedByIpHash),
      length: content.length,
      preview: content.slice(0, ADMIN_PAD_PREVIEW_LENGTH),
      updatedAt: updatedAt.toISOString(),
    }));
  }

  // Moderacao: impede uma origem sem conta (hash do IP) de gravar pads.
  async blockSourceAsAdmin(ipHash: string, request: AdminRequestInfo) {
    await this.prisma.padBlockedSource.upsert({
      where: { ipHash },
      create: { ipHash, blockedById: request.adminId },
      update: {},
    });
    await this.securityLogs.recordEvent({
      type: SecurityEventType.ADMIN_PAD_SOURCE_BLOCKED,
      ip: request.ip,
      method: request.method,
      path: request.path,
      userAgent: request.userAgent,
      userId: request.adminId,
    });
    return { blocked: true };
  }

  async unblockSourceAsAdmin(ipHash: string) {
    await this.prisma.padBlockedSource.deleteMany({ where: { ipHash } });
    return { blocked: false };
  }

  private async isBlockedSource(ipHash: string | null): Promise<boolean> {
    if (!ipHash) return false;
    const blocked = await this.prisma.padBlockedSource.findUnique({
      where: { ipHash },
      select: { ipHash: true },
    });
    return blocked !== null;
  }

  async removeAsAdmin(slug: string, request: AdminRequestInfo) {
    const { count } = await this.prisma.pad.deleteMany({ where: { slug } });
    if (count === 0) throw new NotFoundException('Pad not found.');
    await this.securityLogs.recordEvent({
      type: SecurityEventType.ADMIN_PAD_DELETED,
      ip: request.ip,
      method: request.method,
      path: request.path,
      userAgent: request.userAgent,
      userId: request.adminId,
    });
    return { deleted: true };
  }
}
