import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { OAuthAccountConflictException } from '../exceptions/oauth-account-conflict.exception';
import { getFrontendUrl } from '../../config/app.config';

const FRONTEND_URL = getFrontendUrl();

// Mesmo code que o AccountGuardService devolve a uma conta banida/suspensa.
const ACCOUNT_BLOCKED_CODE = 'ACCOUNT_BLOCKED';

// Token de recurso (appeal) de uma conta bloqueada, se for esse o erro.
function blockedAppealToken(exception: unknown): string | null {
  if (!(exception instanceof HttpException)) return null;
  const body = exception.getResponse();
  if (typeof body !== 'object' || body === null) return null;
  const { code, appealToken } = body as Record<string, unknown>;
  return code === ACCOUNT_BLOCKED_CODE && typeof appealToken === 'string'
    ? appealToken
    : null;
}

/**
 * Sem este filtro, qualquer exceção lançada dentro de uma Passport strategy
 * (durante /auth/google|github|discord/callback) sobe pelo AuthGuard e o
 * NestJS devolve o JSON cru da exceção diretamente na página - porque esta
 * rota é uma navegação GET normal do browser (o utilizador foi
 * redirecionado para aqui pelo Google/GitHub/Discord), não um pedido
 * fetch/XHR que o frontend possa apanhar e tratar.
 *
 * @Catch() sem argumentos apanha QUALQUER exceção nestas rotas (não só
 * OAuthAccountConflictException) - antes só o conflito tinha tratamento
 * bonito e qualquer outro erro (ex: falha real na BD durante um link de
 * conta) caía num 500 genérico e mudo, sem sequer aparecer no terminal.
 * Agora: conflito continua a dar a mensagem específica; qualquer outra
 * coisa fica registada no terminal (Logger) e redireciona com um erro
 * genérico, para o AuthCallback.tsx mostrar algo em vez do JSON cru.
 */
@Catch()
export class OAuthConflictRedirectFilter implements ExceptionFilter {
  private readonly logger = new Logger(OAuthConflictRedirectFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof OAuthAccountConflictException) {
      const params = new URLSearchParams({
        error: 'account_conflict',
        email: exception.conflictEmail,
      });
      response.redirect(`${FRONTEND_URL}/auth/callback?${params.toString()}`);
      return;
    }

    // Conta banida/suspensa (E-06): o mesmo ecra de bloqueio + recurso do
    // login por password, em vez de um "algo correu mal". O token vai no
    // fragmento (#), que o browser nunca manda a nenhum servidor nem fica
    // nos logs de acesso.
    const appealToken = blockedAppealToken(exception);
    if (appealToken) {
      const fragment = new URLSearchParams({ appeal: appealToken });
      response.redirect(
        `${FRONTEND_URL}/auth/callback?error=account_blocked#${fragment.toString()}`,
      );
      return;
    }

    // Qualquer outra coisa (falha de BD, erro de rede a falar com o
    // provider, bug genuíno) - fica no terminal com o stack trace completo
    // para se conseguir diagnosticar, e o browser só vê um redirect limpo.
    this.logger.error(
      'Unhandled error in an OAuth callback',
      exception as Error,
    );
    response.redirect(`${FRONTEND_URL}/auth/callback?error=oauth_failed`);
  }
}
