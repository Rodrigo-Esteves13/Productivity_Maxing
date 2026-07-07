import { ExceptionFilter, Catch, ArgumentsHost } from '@nestjs/common';
import type { Response } from 'express';
import { OAuthAccountConflictException } from '../exceptions/oauth-account-conflict.exception';

const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173';

/**
 * Sem este filtro, um OAuthAccountConflictException lançado dentro de uma
 * Passport strategy (durante /auth/google|github|discord/callback) sobe
 * pelo AuthGuard e o NestJS devolve o JSON cru da exceção diretamente na
 * página - porque esta rota é uma navegação GET normal do browser (o
 * utilizador foi redirecionado para aqui pelo GitHub/Google/Discord), não
 * um pedido fetch/XHR que o frontend possa apanhar e tratar.
 *
 * Isto intercepta especificamente este tipo de exceção nessas rotas e
 * redireciona para o frontend com os detalhes na query string, para o
 * AuthCallback.tsx mostrar uma mensagem decente em vez do JSON cru.
 */
@Catch(OAuthAccountConflictException)
export class OAuthConflictRedirectFilter implements ExceptionFilter {
  catch(exception: OAuthAccountConflictException, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    const params = new URLSearchParams({
      error: 'account_conflict',
      email: exception.conflictEmail,
    });

    response.redirect(`${FRONTEND_URL}/auth/callback?${params.toString()}`);
  }
}