import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SocialService, type CodeChangeRequestView } from './social.service';

/** Pedidos nos ultimos 30 dias (qualquer estado): evita pedir em ciclo. */
const MAX_REQUESTS_PER_30_DAYS = 3;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export interface FriendCodeRequestAdminRow {
  id: string;
  reason: string;
  createdAt: string;
  user: { id: string; name: string | null; email: string };
}

// O codigo de amigo nao se troca sozinho: o utilizador pede (com motivo) e um
// admin decide. Aprovar gera o codigo novo; o antigo deixa de funcionar, mas as
// amizades existentes ficam como estao.
@Injectable()
export class FriendCodeRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly social: SocialService,
  ) {}

  async create(userId: string, reason: string): Promise<CodeChangeRequestView> {
    const pending = await this.prisma.friendCodeChangeRequest.findFirst({
      where: { userId, status: 'PENDING' },
      select: { id: true },
    });
    if (pending) {
      throw new ConflictException(
        'You already have a request waiting for an administrator.',
      );
    }
    const recent = await this.prisma.friendCodeChangeRequest.count({
      where: {
        userId,
        createdAt: { gte: new Date(Date.now() - THIRTY_DAYS_MS) },
      },
    });
    if (recent >= MAX_REQUESTS_PER_30_DAYS) {
      throw new ConflictException(
        'You made too many requests recently. Try again later.',
      );
    }
    const row = await this.prisma.friendCodeChangeRequest.create({
      data: { userId, reason },
      select: { status: true, adminNote: true, createdAt: true },
    });
    return {
      status: row.status,
      adminNote: row.adminNote,
      createdAt: row.createdAt.toISOString(),
    };
  }

  /** Fila do admin: so pendentes, mais antigos primeiro. */
  async listPending(): Promise<FriendCodeRequestAdminRow[]> {
    const rows = await this.prisma.friendCodeChangeRequest.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      take: 200,
      select: {
        id: true,
        reason: true,
        createdAt: true,
        user: { select: { id: true, name: true, email: true } },
      },
    });
    return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
  }

  async decide(
    adminId: string,
    requestId: string,
    approve: boolean,
    note?: string,
  ): Promise<{ id: string; status: 'APPROVED' | 'REJECTED' }> {
    const request = await this.prisma.friendCodeChangeRequest.findFirst({
      where: { id: requestId, status: 'PENDING' },
      select: { id: true, userId: true },
    });
    if (!request) throw new NotFoundException('Request not found.');

    const status = approve ? 'APPROVED' : 'REJECTED';
    // Marca primeiro (so se continuar PENDING): dois admins a clicar ao mesmo
    // tempo nao rodam o codigo duas vezes.
    const claimed = await this.prisma.friendCodeChangeRequest.updateMany({
      where: { id: request.id, status: 'PENDING' },
      data: {
        status,
        decidedAt: new Date(),
        decidedById: adminId,
        adminNote: note || null,
      },
    });
    if (claimed.count === 0) throw new NotFoundException('Request not found.');
    if (approve) await this.social.rotateFriendCode(request.userId);
    return { id: request.id, status };
  }
}
