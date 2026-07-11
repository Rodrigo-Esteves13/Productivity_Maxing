import { Injectable, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import {
  ThrottlerGuard,
  InjectThrottlerOptions,
  InjectThrottlerStorage,
  type ThrottlerModuleOptions,
  type ThrottlerStorage,
  type ThrottlerLimitDetail,
} from '@nestjs/throttler';
import { SecurityLogsService } from '../../security-logs/security-logs.service';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';

interface PendingBucket {
  count: number;
  ip: string;
  method: string;
  path: string;
  userAgent?: string;
  userId?: string | null;
}

// Uma rajada (ex: teste de stress, ou um ataque a sério) pode gerar
// centenas de 429 por segundo. Gravar 1 SecurityLog por pedido bloqueado
// já esgotou o pool de ligações da BD (foi o que aconteceu no teste local
// de 1000 pedidos - ver conversa). Em vez disso, agregamos em memória por
// IP+path e só fazemos flush para a BD no máximo 1x a cada 5s por chave,
// com o `count` real de quantos foram bloqueados nesse intervalo.
const FLUSH_INTERVAL_MS = 5000;

/**
 * Substitui o ThrottlerGuard base como APP_GUARD (ver app.module.ts). Tudo
 * o resto do comportamento (100 req/min global, @Throttle por rota em
 * login/register) fica igual - a única diferença é este hook extra:
 * sempre que um pedido é efetivamente bloqueado (429), agrega o bloqueio
 * em memória e, no máximo a cada 5s por IP+path, grava um SecurityLog
 * (com a contagem acumulada) para a página de admin
 * (/admin/security-logs) mostrar quem está a martelar a API.
 *
 * Os 3 primeiros parâmetros do construtor têm de replicar exatamente os
 * decorators do ThrottlerGuard original (@InjectThrottlerOptions /
 * @InjectThrottlerStorage) - sem eles o Nest não sabe resolver estes
 * tokens e o arranque falha com "Nest can't resolve dependencies".
 */
@Injectable()
export class LoggingThrottlerGuard extends ThrottlerGuard {
  // chave = `${ip}:${path}` - agrega por quem+onde, não por pedido individual.
  // Em memória de propósito: perde-se com o restart do processo, o que é
  // aceitável (isto é telemetria operacional, não o registo definitivo -
  // o que importa é não esgotar a BD numa rajada, não sobreviver a um
  // restart no meio de um ataque).
  private readonly pending = new Map<string, PendingBucket>();
  private readonly lastFlush = new Map<string, number>();

  constructor(
    @InjectThrottlerOptions() options: ThrottlerModuleOptions,
    @InjectThrottlerStorage() storageService: ThrottlerStorage,
    reflector: Reflector,
    private readonly securityLogsService: SecurityLogsService,
  ) {
    super(options, storageService, reflector);
  }

  protected async throwThrottlingException(
    context: ExecutionContext,
    throttlerLimitDetail: ThrottlerLimitDetail,
  ): Promise<void> {
    const req = context.switchToHttp().getRequest<Request>();
    const ip = this.extractIp(req, throttlerLimitDetail.tracker);
    const path = req.originalUrl;
    const key = `${ip}:${path}`;
    const user = req.user as AuthenticatedUser | undefined;

    const existing = this.pending.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      this.pending.set(key, {
        count: 1,
        ip,
        method: req.method,
        path,
        userAgent: req.headers['user-agent'],
        userId: user?.id ?? null,
      });
    }

    const now = Date.now();
    const lastFlushedAt = this.lastFlush.get(key) ?? 0;

    if (now - lastFlushedAt >= FLUSH_INTERVAL_MS) {
      const bucket = this.pending.get(key);
      this.pending.delete(key);
      this.lastFlush.set(key, now);

      if (bucket) {
        // Fire-and-forget de propósito: gravar o log não pode atrasar nem
        // (pior ainda) substituir o 429 por um 500 se a BD estiver em baixo.
        void this.securityLogsService.recordEvent(bucket);
      }
    }

    await super.throwThrottlingException(context, throttlerLimitDetail);
  }

  // O "tracker" do throttler já é o identificador que ele próprio usou
  // para contar os pedidos (req.ip, por omissão - ver getTracker() no
  // ThrottlerGuard base), por isso é a fonte mais fiel do "quem" real.
  // req.ip só é correto com app.set('trust proxy', ...) ativo (ver
  // main.ts) - sem isso, atrás do proxy do Render, seria sempre o IP
  // interno do proxy, não o do cliente.
  private extractIp(req: Request, tracker: string): string {
    return tracker || req.ip || 'unknown';
  }
}
