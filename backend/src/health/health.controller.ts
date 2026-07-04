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
}
