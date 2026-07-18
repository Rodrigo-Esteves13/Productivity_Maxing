import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertAgentConfigDto } from './dto/upsert-agent-config.dto';
import { AgentFailMode, AgentTriggerMode } from '@prisma/client';

// Valores por omissão devolvidos em GET /agent/config quando o user ainda
// não guardou nenhuma configuração - permite à página Agent mostrar o
// formulário já preenchido com algo sensato em vez de campos vazios, sem
// sujar a BD com um registo só por teres aberto a página.
const DEFAULTS = {
  triggerMode: AgentTriggerMode.ANY,
  hasOverdueTasks: true,
  hasOverdueCheckins: false,
  minDifficultyToday: null,
  anyTaskToday: false,
  minProgressStatus: null,
  blockedProcesses: [] as string[],
  blockedDomains: [] as string[],
  failMode: AgentFailMode.CLOSED,
  pollIntervalSeconds: 60,
};

@Injectable()
export class AgentConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async find(userId: string) {
    const config = await this.prisma.agentConfig.findUnique({
      where: { userId },
    });
    if (!config) {
      return { ...DEFAULTS, isConfigured: false };
    }
    return { ...this.toResponse(config), isConfigured: true };
  }

  async upsert(userId: string, dto: UpsertAgentConfigDto) {
    const config = await this.prisma.agentConfig.upsert({
      where: { userId },
      create: { userId, ...dto },
      update: { ...dto },
    });
    return { ...this.toResponse(config), isConfigured: true };
  }

  // Tira os campos internos (id, userId, timestamps) da resposta - o
  // agente e o frontend só precisam das regras em si.
  private toResponse(config: {
    id: string;
    userId: string;
    createdAt: Date;
    updatedAt: Date;
    [key: string]: unknown;
  }) {
    const { id, userId, createdAt, updatedAt, ...rest } = config;
    void id;
    void userId;
    void createdAt;
    void updatedAt;
    return rest;
  }
}
