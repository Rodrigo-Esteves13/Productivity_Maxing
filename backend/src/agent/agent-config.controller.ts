import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AgentConfigService } from './agent-config.service';
import { UpsertAgentConfigDto } from './dto/upsert-agent-config.dto';
import { JwtOrApiKeyAuthGuard } from '../auth/guards/jwt-or-api-key-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

// Mesmo guard do TasksController: esta rota é chamada tanto pela página
// Agent na app (sessão JWT normal) como pelo pmaxing-agent local a correr
// na tua máquina (header x-api-key) - ver JwtOrApiKeyAuthGuard.
@ApiTags('Agent')
@ApiBearerAuth()
@UseGuards(JwtOrApiKeyAuthGuard)
@Controller('agent/config')
export class AgentConfigController {
  constructor(private readonly agentConfigService: AgentConfigService) {}

  // O agente Go faz poll deste endpoint periodicamente (mínimo 60s, ver
  // BootstrapPollIntervalSeconds em config.go) - um limite explícito mais
  // apertado do que o default global (100/min, ver ThrottlerModule em
  // app.module.ts) documenta esse contrato e evita que uma key comprometida
  // consiga fazer polling agressivo sem ser abrandada.
  @Get()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  find(@CurrentUser() user: AuthenticatedUser) {
    return this.agentConfigService.find(user.id);
  }

  @Put()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  upsert(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpsertAgentConfigDto,
  ) {
    return this.agentConfigService.upsert(user.id, dto);
  }
}
