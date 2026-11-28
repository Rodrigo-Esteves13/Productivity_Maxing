import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { safeEqual } from '../common/safe-equal.util';
import { CRON_SECRET_HEADER } from './reminders.constants';

/**
 * Protege as rotas chamadas pelo cron externo. Sem CRON_SECRET configurado a
 * rota "nao existe" (404); com segredo errado ou em falta, 401. Comparacao em
 * tempo constante.
 */
@Injectable()
export class CronSecretGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const expected = process.env.CRON_SECRET;
    if (!expected) throw new NotFoundException();
    const request = context.switchToHttp().getRequest<Request>();
    const given = request.headers[CRON_SECRET_HEADER];
    if (typeof given !== 'string' || !safeEqual(given, expected)) {
      throw new UnauthorizedException();
    }
    return true;
  }
}
