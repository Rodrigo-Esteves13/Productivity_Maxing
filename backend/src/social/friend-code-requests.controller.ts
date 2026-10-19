import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import {
  FriendCodeRequestsService,
  type FriendCodeRequestAdminRow,
} from './friend-code-requests.service';
import { DecideFriendCodeRequestDto } from './dto/social.dto';
import { perMinute } from '../common/throttle.util';

// Admin: decidir pedidos de troca de codigo de amigo. Sessao normal (nao API key):
// aprovar muda dados de outra conta.
@ApiTags('Social')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('friend-code-requests')
export class FriendCodeRequestsController {
  constructor(private readonly requests: FriendCodeRequestsService) {}

  @Get()
  @ApiOperation({ summary: 'Pending friend code change requests.' })
  list(): Promise<FriendCodeRequestAdminRow[]> {
    return this.requests.listPending();
  }

  @Post(':id/decision')
  @HttpCode(HttpStatus.OK)
  @Throttle(perMinute(30))
  @ApiOperation({ summary: 'Approve (new code) or reject a request.' })
  decide(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DecideFriendCodeRequestDto,
  ) {
    return this.requests.decide(admin.id, id, dto.approve, dto.note);
  }
}
