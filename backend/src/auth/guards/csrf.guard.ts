import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import type { Request } from 'express';
import { ACCESS_TOKEN_COOKIE, CSRF_COOKIE } from '../cookie.config';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Proteção CSRF via "double submit cookie": o cookie csrf_token (legível por
 * JS) tem de bater certo com o header X-CSRF-Token que o frontend envia em
 * todos os pedidos que alteram estado. Um site atacante consegue fazer o
 * browser enviar o cookie automaticamente, mas não consegue LER o cookie
 * para copiar o valor para o header (isso violaria same-origin policy).
 *
 * Só se aplica quando o pedido está de facto a usar sessão por cookie
 * (access_token presente). Pedidos autenticados por API Key (header
 * x-api-key, usado pelo agente/scripts, nunca por um browser) não passam
 * por aqui: não há cookie automático a atacar, logo não há CSRF a proteger.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();

    if (SAFE_METHODS.has(req.method.toUpperCase())) {
      return true;
    }

    const cookies = req.cookies as Record<string, string | undefined>;

    const accessTokenCookie = cookies?.[ACCESS_TOKEN_COOKIE];
    if (!accessTokenCookie) {
      // Não é uma sessão por cookie (ex: API Key, ou ainda não fez login) -
      // nada a validar aqui.
      return true;
    }

    const cookieCsrf = cookies?.[CSRF_COOKIE];
    const headerCsrf = req.headers['x-csrf-token'];

    if (
      !cookieCsrf ||
      !headerCsrf ||
      typeof headerCsrf !== 'string' ||
      cookieCsrf !== headerCsrf
    ) {
      throw new ForbiddenException('Invalid or missing CSRF token.');
    }

    return true;
  }
}
