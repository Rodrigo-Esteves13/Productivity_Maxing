import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { HealthService } from './health.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  // Rota pública de propósito (sem @UseGuards) - o frontend faz ping sem token
  @Get()
  @ApiOperation({
    summary: 'Checks whether the API and database are operational',
  })
  async check() {
    const result = await this.healthService.check();

    // Se a BD estiver em baixo, devolve 503 para o frontend distinguir "down" de "ok"
    if (result.status === 'error') {
      throw new ServiceUnavailableException(result);
    }

    return result;
  }

  // Liveness: so confirma que o processo responde. Nao toca na BD de
  // proposito - uma falha transitoria da BD nao deve levar o Render a
  // reiniciar uma instancia que esta perfeitamente viva.
  @Get('live')
  @ApiOperation({ summary: 'Liveness probe (process is up, no dependencies)' })
  live() {
    return this.healthService.live();
  }

  // Readiness: a instancia so deve receber trafego se a BD responder.
  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe (database reachable)' })
  async ready() {
    const result = await this.healthService.check();

    if (result.status === 'error') {
      throw new ServiceUnavailableException(result);
    }

    return result;
  }
}
