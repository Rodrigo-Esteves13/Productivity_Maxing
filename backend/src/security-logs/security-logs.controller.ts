import {
  Controller,
  Get,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SecurityLogsService } from './security-logs.service';
import { QuerySecurityLogsDto } from './dto/query-security-logs.dto';
import { PurgeSecurityLogsDto } from './dto/purge-security-logs.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

// Tudo aqui é ADMIN only - estes logs mostram IPs e paths visados, dados
// que só interessam a quem está a defender a plataforma.
@ApiTags('Security (Admin)')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@ApiBearerAuth()
@Controller('admin/security-logs')
export class SecurityLogsController {
  constructor(private readonly securityLogsService: SecurityLogsService) {}

  @Get()
  @ApiOperation({
    summary:
      'Lista os bloqueios de rate limit (candidatos a DoS), paginados e filtráveis (Apenas ADMIN)',
  })
  findAll(@Query() query: QuerySecurityLogsDto) {
    return this.securityLogsService.findAll(query);
  }

  @Get('stats')
  @ApiOperation({
    summary:
      'Resumo agregado: volume na última hora/24h e ranking dos IPs mais ofensivos (Apenas ADMIN)',
  })
  getStats() {
    return this.securityLogsService.getStats();
  }

  @Delete()
  @ApiOperation({
    summary:
      'Apaga logs antigos (ou todos, se olderThanDays não for indicado) (Apenas ADMIN)',
  })
  purge(@Query() query: PurgeSecurityLogsDto) {
    return this.securityLogsService.purge(query.olderThanDays);
  }
}
