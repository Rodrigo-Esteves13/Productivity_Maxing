import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import {
  AdminSocialService,
  type AdminSocialProfile,
} from './admin-social.service';
import { perMinute } from '../common/throttle.util';

// Admin: ligacoes sociais de uma conta e codigo de amigo. Sessao normal (nao
// API key), como o resto da gestao de utilizadores.
@ApiTags('Social')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/social/users')
export class AdminSocialController {
  constructor(private readonly adminSocial: AdminSocialService) {}

  @Get(':id')
  @ApiOperation({
    summary:
      "A user's friend code, friendships, requests, blocks and shared notes (Admin only).",
  })
  @ApiParam({ name: 'id', description: 'User UUID' })
  profile(@Param('id', ParseUUIDPipe) id: string): Promise<AdminSocialProfile> {
    return this.adminSocial.profile(id);
  }

  @Post(':id/friend-code')
  @HttpCode(HttpStatus.OK)
  @Throttle(perMinute(30))
  @ApiOperation({
    summary:
      'Generates a new friend code for a user, no request needed (Admin only).',
  })
  @ApiParam({ name: 'id', description: 'User UUID' })
  regenerateFriendCode(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ friendCode: string }> {
    return this.adminSocial.regenerateFriendCode(admin.id, id);
  }
}
