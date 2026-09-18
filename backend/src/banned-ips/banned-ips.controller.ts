import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BannedIpsService } from './banned-ips.service';
import { CreateBannedIpDto } from './dto/create-banned-ip.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

// ADMIN only, mesmo padrão do /admin/security-logs.
@ApiTags('Security (Admin)')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@ApiBearerAuth()
@Controller('admin/banned-ips')
export class BannedIpsController {
  constructor(private readonly bannedIpsService: BannedIpsService) {}

  @Get()
  @ApiOperation({ summary: 'Lists every currently banned IP (ADMIN only)' })
  findAll() {
    return this.bannedIpsService.findAll();
  }

  @Post()
  @ApiOperation({
    summary:
      'Bans an IP - blocked on every request from the moment this returns (ADMIN only)',
  })
  ban(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateBannedIpDto) {
    return this.bannedIpsService.ban(user.id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Unbans an IP (ADMIN only)' })
  unban(@Param('id') id: string) {
    return this.bannedIpsService.unban(id);
  }
}
