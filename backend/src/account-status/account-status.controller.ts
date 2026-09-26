import { Controller, Get, UseGuards } from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { AccountStatusService } from './account-status.service';
import { JwtBlockedAwareGuard } from '../auth/guards/jwt-blocked-aware-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

@ApiTags('Account status')
@Controller('account-status')
export class AccountStatusController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accountStatus: AccountStatusService,
  ) {}

  // Único consumidor deste endpoint: AccountBlockedPage no frontend - o
  // ecrã que substitui a app inteira quando a conta está SUSPENDED/
  // BANNED. Usa JwtBlockedAwareGuard de propósito (ver o comentário lá):
  // uma sessão normal (JwtAuthGuard) já rejeitaria este pedido com 401
  // antes de sequer chegar aqui, que é exatamente o problema que este
  // endpoint existe para resolver. Devolve 200 mesmo para uma conta
  // ACTIVE (nada aqui é sensível que o próprio dono não possa ver).
  @Get('me')
  @UseGuards(JwtBlockedAwareGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Gets the current status of the authenticated account, including any appeal already in flight',
  })
  async getMyStatus(@CurrentUser() user: AuthenticatedUser) {
    const [account, latestAppeal] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({
        where: { id: user.id },
        select: {
          status: true,
          suspendedUntil: true,
          statusReason: true,
          statusUpdatedAt: true,
        },
      }),
      this.prisma.userAppeal.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          createdAt: true,
          resolution: true,
          resolutionNote: true,
          resolvedAt: true,
        },
      }),
    ]);

    // Só vale a pena calcular isto para quem está mesmo restringido - a
    // esmagadora maioria dos pedidos a este endpoint é de contas ACTIVE
    // (ver AccountBlockedGate.tsx, que faz poll disto a toda a gente).
    const appealAvailability =
      account.status === UserStatus.ACTIVE
        ? null
        : await this.accountStatus.getAppealAvailability(user.id, account);

    return { ...account, appeal: latestAppeal, appealAvailability };
  }
}
