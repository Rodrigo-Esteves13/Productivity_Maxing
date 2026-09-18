import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import type { Request } from 'express';
import { BannedIpsService } from '../../banned-ips/banned-ips.service';

// Health check nunca pode ficar bloqueado por um ban - um uptime monitor
// não tem IP fixo garantido em todos os provedores, e mesmo que tivesse,
// bloquear o health check transformaria "banir um atacante" em "o Render
// acha que o serviço caiu" - mesma exceção que o MaintenanceGuard já
// tem.
const ALWAYS_ALLOWED_PATHS = new Set(['/health']);

/**
 * Primeiro guard global (ver app.module.ts - regista-se antes até do
 * MaintenanceGuard): um IP banido nunca deve gastar tempo de
 * processamento nem ver seja o que for da API, nem sequer um 503 de
 * manutenção. A verificação em si (BannedIpsService.isBanned) é O(1) em
 * memória, não bate na base de dados a cada pedido.
 */
@Injectable()
export class BannedIpGuard implements CanActivate {
  constructor(private readonly bannedIpsService: BannedIpsService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    if (ALWAYS_ALLOWED_PATHS.has(req.path)) return true;

    // req.ip só é o IP real do cliente (não o do proxy do Render) com
    // app.set('trust proxy', ...) ativo - já configurado em main.ts pelo
    // mesmo motivo do LoggingThrottlerGuard. O Express tipa req.ip como
    // opcional (falha rara de resolução do socket); nesse caso não há IP
    // nenhum para comparar contra a cache de banidos, por isso não
    // bloqueamos (fail-open aqui, nunca fail-closed num guard global).
    if (req.ip && this.bannedIpsService.isBanned(req.ip)) {
      throw new ForbiddenException('Access denied.');
    }

    return true;
  }
}
