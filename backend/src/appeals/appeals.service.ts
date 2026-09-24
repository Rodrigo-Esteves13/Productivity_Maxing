import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { AppealResolution, UserStatus } from '@prisma/client';
import { CreateAppealDto } from './dto/create-appeal.dto';
import { ResolveAppealDto } from './dto/resolve-appeal.dto';

const APPEAL_ADMIN_SELECT = {
  id: true,
  message: true,
  statusAtSubmission: true,
  reasonAtSubmission: true,
  createdAt: true,
  resolution: true,
  resolutionNote: true,
  resolvedAt: true,
  resolvedBy: { select: { id: true, name: true, email: true } },
  user: { select: { id: true, name: true, email: true } },
} as const;

@Injectable()
export class AppealsService {
  constructor(
    private readonly prisma: PrismaService,
    // Reaproveitado só para o "approve" (ver resolve() abaixo) -
    // reactivateUser() já trata do status/cache/statusReason, evita
    // duplicar essa lógica aqui.
    private readonly usersService: UsersService,
  ) {}

  /**
   * Chamado por AccountStatusController (GET /account-status/me) para o
   * ecrã de bloqueio saber se já existe um appeal em curso, em vez de
   * mostrar sempre o formulário. Devolve o mais recente independentemente
   * do estado (resolvido ou não) - se o mais recente foi DENIED, o
   * frontend mostra isso e ainda deixa submeter um novo.
   */
  findLatestForUser(userId: string) {
    return this.prisma.userAppeal.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        createdAt: true,
        resolution: true,
        resolutionNote: true,
        resolvedAt: true,
      },
    });
  }

  /**
   * Só alcançável via JwtBlockedAwareGuard (ver o comentário lá) - o
   * próprio JWT/appealToken já garante que "userId" é quem diz ser. A
   * validação de "a conta está mesmo bloqueada" e de "não há já um
   * appeal pendente" é feita aqui, não confiada ao frontend.
   */
  async create(userId: string, dto: CreateAppealDto) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { status: true, statusReason: true },
    });

    if (user.status === UserStatus.ACTIVE) {
      throw new ConflictException('Your account is not currently restricted.');
    }

    const pending = await this.prisma.userAppeal.findFirst({
      where: { userId, resolvedAt: null },
      select: { id: true },
    });
    if (pending) {
      throw new ConflictException(
        'You already have a pending appeal. Please wait for it to be reviewed.',
      );
    }

    return this.prisma.userAppeal.create({
      data: {
        userId,
        message: dto.message,
        statusAtSubmission: user.status,
        reasonAtSubmission: user.statusReason,
      },
      select: { id: true, createdAt: true },
    });
  }

  /** ADMIN only - ver o guard no controller. Mais recentes primeiro. */
  findAll(onlyPending: boolean) {
    return this.prisma.userAppeal.findMany({
      where: onlyPending ? { resolvedAt: null } : {},
      orderBy: { createdAt: 'desc' },
      select: APPEAL_ADMIN_SELECT,
    });
  }

  /**
   * ADMIN only. APPROVED reaproveita UsersService.reactivateUser (mesmo
   * efeito do botão "Reactivate" no painel de Users) - nunca duplicar
   * essa lógica aqui. DENIED só regista a decisão; a conta continua
   * bloqueada como estava, e a pessoa pode submeter um novo appeal
   * depois (sem cooldown - não pareceu valer a pena para este volume).
   */
  async resolve(adminId: string, appealId: string, dto: ResolveAppealDto) {
    const appeal = await this.prisma.userAppeal.findUnique({
      where: { id: appealId },
      select: { id: true, userId: true, resolvedAt: true },
    });
    if (!appeal) {
      throw new NotFoundException('Appeal not found.');
    }
    if (appeal.resolvedAt) {
      throw new ConflictException('This appeal has already been resolved.');
    }

    if (dto.resolution === AppealResolution.APPROVED) {
      await this.usersService.reactivateUser(adminId, appeal.userId);
    }

    return this.prisma.userAppeal.update({
      where: { id: appealId },
      data: {
        resolution: dto.resolution,
        resolutionNote: dto.resolutionNote,
        resolvedAt: new Date(),
        resolvedByUserId: adminId,
      },
      select: APPEAL_ADMIN_SELECT,
    });
  }
}
