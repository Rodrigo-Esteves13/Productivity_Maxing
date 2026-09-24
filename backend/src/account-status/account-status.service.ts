import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserStatus } from '@prisma/client';

interface BlockInfo {
  status: UserStatus;
  suspendedUntil: Date | null;
}

/**
 * À parte de UsersService (que vive em UsersModule, que já importa
 * AuthModule para reaproveitar o deleteAccount) de propósito: JwtStrategy
 * (em AuthModule) precisa de consultar o estado da conta em TODOS os
 * pedidos autenticados, e AuthModule importar UsersModule fecharia um
 * ciclo (UsersModule -> AuthModule -> UsersModule). Este serviço não
 * importa nenhum dos dois, por isso ambos os módulos o podem importar
 * sem problema.
 *
 * Mesmo raciocínio de cache que BannedIpsService, mas por conta em vez de
 * por IP - isBlocked() tem de ser síncrono e O(1), nunca uma query à BD
 * no caminho de todos os pedidos. Só ficam na cache as contas
 * SUSPENDED/BANNED (a esmagadora maioria é ACTIVE).
 */
@Injectable()
export class AccountStatusService implements OnModuleInit {
  private readonly logger = new Logger(AccountStatusService.name);
  private cache = new Map<string, BlockInfo>();

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    const rows = await this.prisma.user.findMany({
      where: { status: { in: [UserStatus.SUSPENDED, UserStatus.BANNED] } },
      select: { id: true, status: true, suspendedUntil: true },
    });
    this.cache = new Map(
      rows.map((r) => [
        r.id,
        { status: r.status, suspendedUntil: r.suspendedUntil },
      ]),
    );
    this.logger.log(
      `Carregadas ${this.cache.size} conta(s) suspensa(s)/banida(s) para a cache.`,
    );
  }

  /**
   * Chamado pelo JwtStrategy.validate() em todos os pedidos autenticados.
   * Uma suspensão cuja data já passou conta como "não bloqueado" aqui
   * mesmo antes de a BD ser corrigida - reactivateIfExpired() escreve
   * isso na BD de forma assíncrona (fire-and-forget), para este caminho
   * nunca esperar por um UPDATE.
   *
   * "code" segue o mesmo padrão de MaintenanceGuard/MAINTENANCE_MODE - é
   * o que o interceptor do axios no frontend usa para mostrar
   * AccountBlockedPage em vez de simplesmente deslogar a pessoa. Ver
   * AuthService.accountBlockedResponse() para o mesmo código do lado do
   * login (esta cache não tem statusReason/appealToken - o frontend
   * busca isso a GET /account-status/me, que já tem a sessão/cookie).
   */
  isBlocked(userId: string): {
    blocked: boolean;
    code?: 'ACCOUNT_BLOCKED';
    message?: string;
  } {
    const info = this.cache.get(userId);
    if (!info) return { blocked: false };

    if (info.status === UserStatus.SUSPENDED) {
      if (info.suspendedUntil && info.suspendedUntil.getTime() <= Date.now()) {
        this.reactivateIfExpired(userId).catch((err) =>
          this.logger.warn(`Could not auto-reactivate ${userId}: ${err}`),
        );
        return { blocked: false };
      }
      return {
        blocked: true,
        code: 'ACCOUNT_BLOCKED',
        message: 'Your account is temporarily suspended.',
      };
    }

    return {
      blocked: true,
      code: 'ACCOUNT_BLOCKED',
      message: 'Your account has been banned.',
    };
  }

  private async reactivateIfExpired(userId: string): Promise<void> {
    // where status/suspendedUntil de novo dentro do próprio UPDATE, para
    // nunca reativar por engano uma conta que um admin, entretanto,
    // tenha voltado a mudar de estado (ex: suspensão renovada).
    const result = await this.prisma.user.updateMany({
      where: {
        id: userId,
        status: UserStatus.SUSPENDED,
        suspendedUntil: { lte: new Date() },
      },
      data: {
        status: UserStatus.ACTIVE,
        suspendedUntil: null,
        statusReason: null,
        statusUpdatedAt: new Date(),
        statusUpdatedByUserId: null,
      },
    });
    if (result.count > 0) {
      this.cache.delete(userId);
      this.logger.log(
        `Suspensão de ${userId} expirou - conta reativada automaticamente.`,
      );
    }
  }

  // Chamados pelo UsersService logo a seguir a escrever o novo estado na
  // BD - o "efeito imediato" do ban/suspend não pode esperar por um
  // restart nem por um refresh periódico da cache.
  markBlocked(
    userId: string,
    status: Extract<UserStatus, 'SUSPENDED' | 'BANNED'>,
    suspendedUntil: Date | null,
  ): void {
    this.cache.set(userId, { status, suspendedUntil });
  }

  clearBlocked(userId: string): void {
    this.cache.delete(userId);
  }
}
