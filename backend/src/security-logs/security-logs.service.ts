import { MS_PER_DAY, MS_PER_HOUR } from '../common/time.constants';
import { Injectable, Logger } from '@nestjs/common';
import { Prisma, SecurityEventType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QuerySecurityLogsDto } from './dto/query-security-logs.dto';

export interface RecordSecurityEventInput {
  type?: SecurityEventType;
  ip: string;
  method: string;
  path: string;
  userAgent?: string | null;
  userId?: string | null;
  // Nº de bloqueios agregados nesta linha (ver LoggingThrottlerGuard: em
  // vez de 1 escrita por pedido bloqueado, agrega em memória e faz flush
  // periódico com a contagem real, para não esgotar o pool de ligações
  // numa rajada).
  count?: number;
}

const WINDOW_TO_MS: Record<
  NonNullable<QuerySecurityLogsDto['window']>,
  number
> = {
  '1h': MS_PER_HOUR,
  '24h': MS_PER_DAY,
  '7d': 7 * MS_PER_DAY,
};

const DEFAULT_LOG_PAGE_SIZE = 25;
// Quantos IPs aparecem no ranking das ultimas 24h.
const TOP_IPS_LIMIT = 10;

@Injectable()
export class SecurityLogsService {
  private readonly logger = new Logger('SecurityLogs');

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Chamado pelo LoggingThrottlerGuard sempre que um pedido é bloqueado por
   * excesso de rate limit. De propósito nunca lança - um problema a
   * escrever o log de auditoria não pode impedir o 429 de ser devolvido
   * (isso seria pior: mascarava o próprio ataque atrás de um erro 500).
   */
  async recordEvent(input: RecordSecurityEventInput): Promise<void> {
    try {
      await this.prisma.securityLog.create({
        data: {
          type: input.type ?? SecurityEventType.RATE_LIMIT_EXCEEDED,
          ip: input.ip,
          method: input.method,
          path: input.path,
          userAgent: input.userAgent ?? undefined,
          userId: input.userId ?? undefined,
          count: input.count ?? 1,
        },
      });
    } catch (err) {
      this.logger.error('Failed to persist security log', err as Error);
    }
  }

  async findAll(query: QuerySecurityLogsDto) {
    const where: Prisma.SecurityLogWhereInput = {
      ...(query.ip ? { ip: query.ip } : {}),
      ...(query.path
        ? { path: { contains: query.path, mode: 'insensitive' } }
        : {}),
      ...(query.window
        ? {
            createdAt: {
              gte: new Date(Date.now() - WINDOW_TO_MS[query.window]),
            },
          }
        : {}),
    };

    const [total, logs] = await this.prisma.$transaction([
      this.prisma.securityLog.count({ where }),
      this.prisma.securityLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: query.skip ?? 0,
        take: query.take ?? DEFAULT_LOG_PAGE_SIZE,
        include: {
          user: { select: { id: true, email: true, name: true } },
        },
      }),
    ]);

    return {
      total,
      skip: query.skip ?? 0,
      take: query.take ?? DEFAULT_LOG_PAGE_SIZE,
      logs,
    };
  }

  /**
   * Visão agregada para o topo da página de admin: volume recente e quais
   * IPs estão a martelar mais a API. groupBy em vez de puxar tudo para JS -
   * a tabela pode crescer bastante em caso de ataque a sério.
   */
  async getStats() {
    const now = Date.now();
    const last1h = new Date(now - WINDOW_TO_MS['1h']);
    const last24h = new Date(now - WINDOW_TO_MS['24h']);

    const [totalLastHour, totalLast24h, topOffenders] = await Promise.all([
      this.prisma.securityLog.count({ where: { createdAt: { gte: last1h } } }),
      this.prisma.securityLog.count({ where: { createdAt: { gte: last24h } } }),
      this.prisma.securityLog.groupBy({
        by: ['ip'],
        where: { createdAt: { gte: last24h } },
        _count: { ip: true },
        orderBy: { _count: { ip: 'desc' } },
        take: TOP_IPS_LIMIT,
      }),
    ]);

    return {
      totalLastHour,
      totalLast24h,
      topOffenders: topOffenders.map((row) => ({
        ip: row.ip,
        count: row._count.ip,
      })),
    };
  }

  /**
   * Limpeza manual pelo admin. Sem cron/rotação automática por agora - o
   * volume não justifica ainda, e um botão "Clear old logs" na UI chega.
   */
  async purge(olderThanDays?: number): Promise<{ deleted: number }> {
    const where: Prisma.SecurityLogWhereInput = olderThanDays
      ? {
          createdAt: {
            lt: new Date(Date.now() - olderThanDays * MS_PER_DAY),
          },
        }
      : {};

    const { count } = await this.prisma.securityLog.deleteMany({ where });
    return { deleted: count };
  }
}
