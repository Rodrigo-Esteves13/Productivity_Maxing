import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface HealthResult {
  status: 'ok' | 'error';
  uptime: number;
  database: 'connected' | 'unreachable';
  timestamp: string;
}

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async check(): Promise<HealthResult> {
    const databaseOk = await this.pingDatabase();

    return {
      status: databaseOk ? 'ok' : 'error',
      uptime: process.uptime(),
      database: databaseOk ? 'connected' : 'unreachable',
      timestamp: new Date().toISOString(),
    };
  }

  // Query super leve só para confirmar que a ligação à BD está viva
  private async pingDatabase(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}
