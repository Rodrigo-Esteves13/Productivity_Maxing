import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User, UserStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AccountStatusService } from '../../account-status/account-status.service';
import { AppealTokenPayload } from '../interfaces/jwt-payload.interface';

// Regras de "esta conta pode entrar?" partilhadas pelo login por password e
// pelo OAuth (os dois convergem aqui antes de emitir um JWT).
@Injectable()
export class AccountGuardService {
  private readonly logger = new Logger(AccountGuardService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private accountStatus: AccountStatusService,
  ) {}

  /**
   * Bloqueia login (password e OAuth convergem ambos em syncLocalUser)
   * para uma conta banida ou ainda dentro do período de suspensão. Ao
   * contrário do JwtStrategy (que só pode confiar na cache por questões
   * de performance), aqui compensa corrigir logo uma suspensão expirada
   * na BD - é um caminho raro, não um pedido autenticado normal.
   */
  assertAccountIsUsable(user: User): void {
    if (user.status === UserStatus.BANNED) {
      throw new UnauthorizedException(this.accountBlockedResponse(user));
    }
    if (user.status === UserStatus.SUSPENDED) {
      if (user.suspendedUntil && user.suspendedUntil.getTime() <= Date.now()) {
        this.prisma.user
          .update({
            where: { id: user.id },
            data: {
              status: UserStatus.ACTIVE,
              suspendedUntil: null,
              statusReason: null,
              statusUpdatedAt: new Date(),
              statusUpdatedByUserId: null,
            },
          })
          .then(() => this.accountStatus.clearBlocked(user.id))
          .catch((err: unknown) =>
            this.logger.warn(
              `Could not auto-reactivate ${user.id}: ${err instanceof Error ? err.message : String(err)}`,
            ),
          );
        return;
      }
      throw new UnauthorizedException(this.accountBlockedResponse(user));
    }
  }

  /**
   * Corpo de erro estruturado partilhado pelos dois pontos de rejeição de
   * login acima (banido / suspenso ainda dentro do prazo). O "code"
   * (mesmo padrão de MaintenanceGuard/MAINTENANCE_MODE) é o que o
   * interceptor do axios no frontend usa para distinguir isto de um 401
   * qualquer e mostrar AccountBlockedPage em vez do formulário de login.
   *
   * appealToken: token à parte (ver AppealTokenPayload), de 15 minutos,
   * que deixa a pessoa ver o próprio estado (GET /account-status/me) e
   * submeter um recurso (POST /appeals) via "Authorization: Bearer" SEM
   * nenhuma sessão normal - só chega a este ponto porque o login em si
   * FALHOU, não há cookie nenhum para reaproveitar. Ver
   * JwtBlockedAwareStrategy para os detalhes de porque isto nunca serve
   * para mais nenhuma rota.
   */
  private accountBlockedResponse(user: User) {
    const appealPayload: AppealTokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      purpose: 'appeal',
    };
    return {
      code: 'ACCOUNT_BLOCKED' as const,
      message:
        user.status === UserStatus.BANNED
          ? 'This account has been banned.'
          : `This account is suspended until ${user.suspendedUntil?.toLocaleDateString() ?? 'an unknown date'}.`,
      appealToken: this.jwtService.sign(appealPayload, { expiresIn: '15m' }),
    };
  }
}
