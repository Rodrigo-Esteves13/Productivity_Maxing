import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBannedIpDto } from './dto/create-banned-ip.dto';

/**
 * Bloqueia IPs banidos antes de tudo o resto (ver BannedIpGuard, primeiro
 * APP_GUARD em app.module.ts - corre antes até do MaintenanceGuard). Isso
 * significa uma verificação no MÍNIMO em todos os pedidos à API, por
 * isso mantemos um Set em memória em vez de bater na BD a cada pedido -
 * mesmo raciocínio de custo que levou o LoggingThrottlerGuard a agregar
 * em memória antes de gravar. O Set é a fonte da verdade para o Guard; a
 * BD é a fonte da verdade para sobreviver a um restart (recarregado em
 * onModuleInit) e para a página de admin listar/gerir.
 */
@Injectable()
export class BannedIpsService implements OnModuleInit {
  private readonly logger = new Logger(BannedIpsService.name);
  private cache = new Set<string>();

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    const rows = await this.prisma.bannedIp.findMany({ select: { ip: true } });
    this.cache = new Set(rows.map((r) => r.ip));
    this.logger.log(
      `Carregados ${this.cache.size} IP(s) banido(s) para a cache.`,
    );
  }

  // Chamado pelo BannedIpGuard em TODOS os pedidos - tem de ser síncrono
  // e O(1), nunca uma query à BD.
  isBanned(ip: string): boolean {
    return this.cache.has(ip);
  }

  async findAll() {
    return this.prisma.bannedIp.findMany({
      orderBy: { createdAt: 'desc' },
      include: { bannedBy: { select: { id: true, name: true, email: true } } },
    });
  }

  async ban(adminUserId: string, dto: CreateBannedIpDto) {
    const existing = await this.prisma.bannedIp.findUnique({
      where: { ip: dto.ip },
    });
    if (existing) {
      throw new ConflictException(`${dto.ip} is already banned.`);
    }

    const created = await this.prisma.bannedIp.create({
      data: { ip: dto.ip, reason: dto.reason, bannedByUserId: adminUserId },
    });
    // Efeito no bloqueio é imediato - não espera pelo próximo restart nem
    // por um refresh periódico.
    this.cache.add(dto.ip);
    return created;
  }

  async unban(id: string) {
    const existing = await this.prisma.bannedIp.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Banned IP not found.');
    }

    await this.prisma.bannedIp.delete({ where: { id } });
    this.cache.delete(existing.ip);
    return { unbanned: existing.ip };
  }
}
