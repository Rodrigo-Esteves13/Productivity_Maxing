import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import { Observable } from 'rxjs';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { redactSecretPath } from '../redact-secret-path.util';

/**
 * Interceptor global: para cada pedido HTTP, escreve no terminal do backend
 * quem o fez (se autenticado) e o que pediu.
 *
 * Corre DEPOIS dos Guards (ordem do Nest: middleware -> guards ->
 * interceptors), por isso req.user já está preenchido nas rotas protegidas
 * pelo JwtAuthGuard nesse momento. Em rotas públicas (login, register,
 * callbacks OAuth antes de autenticar), req.user ainda não existe - fica
 * registado como "anónimo", o que também é útil para ver tentativas de
 * acesso sem sessão.
 *
 * O log leva só id e role (nunca o email) e o caminho sem query string.
 *
 * Isto é só visibilidade em dev/terminal, não é um sistema de auditoria
 * persistente - não temos aqui garantias de armazenamento nem de rotação
 * de logs.
 *
 * Exclui /health: é o próprio frontend a fazer self-ping periódico (o
 * indicador "All systems operational"), não uma ação de um utilizador -
 * loggar isto só inundava o terminal a cada poucos segundos sem dizer nada
 * de útil.
 */
// Sem query string: pode trazer conteudo pesquisado (q=...) ou tokens.
function pathWithoutQuery(url: string): string {
  const queryStart = url.indexOf('?');
  return queryStart === -1 ? url : url.slice(0, queryStart);
}

@Injectable()
export class RequestUserLoggerInterceptor implements NestInterceptor {
  private readonly logger = new Logger('RequestLog');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();

    if (req.originalUrl.startsWith('/health')) {
      return next.handle();
    }

    const user = req.user as AuthenticatedUser | undefined;

    const who = user ? `id=${user.id}, role=${user.role}` : 'anonymous';

    this.logger.log(
      `${req.method} ${redactSecretPath(pathWithoutQuery(req.originalUrl))} - user: ${who}`,
    );

    return next.handle();
  }
}
