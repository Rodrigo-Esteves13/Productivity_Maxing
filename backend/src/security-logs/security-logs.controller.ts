import { Controller, Get, Delete, Query, UseGuards } from '@nestjs/common';
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
      'Lists rate limit blocks (DoS candidates), paginated and filterable (ADMIN only)',
  })
  findAll(@Query() query: QuerySecurityLogsDto) {
    return this.securityLogsService.findAll(query);
  }

  @Get('stats')
  @ApiOperation({
    summary:
      'Aggregated summary: volume in the last hour/24h and ranking of the most offending IPs (ADMIN only)',
  })
  getStats() {
    return this.securityLogsService.getStats();
  }

  @Delete()
  @ApiOperation({
    summary:
      'Deletes old logs (or all, if olderThanDays is not provided) (ADMIN only)',
  })
  purge(@Query() query: PurgeSecurityLogsDto) {
    return this.securityLogsService.purge(query.olderThanDays);
  }
}
