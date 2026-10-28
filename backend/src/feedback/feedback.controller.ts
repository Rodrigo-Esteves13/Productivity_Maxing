import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ApiKeyScope, Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtOrApiKeyAuthGuard } from '../auth/guards/jwt-or-api-key-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ApiKeyScopeGuard } from '../auth/guards/api-key-scope.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequireApiKeyScope } from '../auth/decorators/require-api-key-scope.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { FeedbackService } from './feedback.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import {
  MuteFeedbackDto,
  RejectFeedbackDto,
  ReplyFeedbackDto,
  ResolveFeedbackDto,
} from './dto/moderate-feedback.dto';
import { perMinute } from '../common/throttle.util';

@ApiTags('Feedback')
@ApiBearerAuth()
@Controller('feedback')
export class FeedbackController {
  constructor(private readonly feedback: FeedbackService) {}

  @UseGuards(JwtAuthGuard)
  @Throttle(perMinute(5))
  @Post()
  @HttpCode(201)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateFeedbackDto,
  ) {
    return this.feedback.create(user.id, dto);
  }

  // Rotas literais antes das que tem :id.
  @UseGuards(JwtAuthGuard)
  @Get('mine')
  @ApiOperation({ summary: 'Feedback sent by the current user, with replies' })
  listMine(@CurrentUser() user: AuthenticatedUser) {
    return this.feedback.listMine(user.id);
  }

  @UseGuards(JwtOrApiKeyAuthGuard, RolesGuard, ApiKeyScopeGuard)
  @Roles(Role.ADMIN)
  @RequireApiKeyScope(ApiKeyScope.ADMIN)
  @Get()
  list() {
    return this.feedback.list();
  }

  @UseGuards(JwtOrApiKeyAuthGuard, RolesGuard, ApiKeyScopeGuard)
  @Roles(Role.ADMIN)
  @RequireApiKeyScope(ApiKeyScope.ADMIN)
  @Patch('users/:userId/muted')
  @ApiOperation({ summary: 'Blocks or allows a user sending feedback (Admin)' })
  setMuted(
    @CurrentUser() me: AuthenticatedUser,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: MuteFeedbackDto,
  ) {
    if (me.id === userId) {
      throw new ForbiddenException('You cannot mute your own account.');
    }
    return this.feedback.setMuted(userId, dto.muted);
  }

  @UseGuards(JwtOrApiKeyAuthGuard, RolesGuard, ApiKeyScopeGuard)
  @Roles(Role.ADMIN)
  @RequireApiKeyScope(ApiKeyScope.ADMIN)
  @Patch(':id/resolved')
  setResolved(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolveFeedbackDto,
  ) {
    return this.feedback.setResolved(id, dto.isResolved);
  }

  @UseGuards(JwtOrApiKeyAuthGuard, RolesGuard, ApiKeyScopeGuard)
  @Roles(Role.ADMIN)
  @RequireApiKeyScope(ApiKeyScope.ADMIN)
  @Throttle(perMinute(30))
  @Post(':id/reply')
  @ApiOperation({ summary: 'Replies to the author, optionally resolving (Admin)' })
  reply(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReplyFeedbackDto,
  ) {
    return this.feedback.reply(id, dto);
  }

  @UseGuards(JwtOrApiKeyAuthGuard, RolesGuard, ApiKeyScopeGuard)
  @Roles(Role.ADMIN)
  @RequireApiKeyScope(ApiKeyScope.ADMIN)
  @Throttle(perMinute(30))
  @Post(':id/reject')
  @ApiOperation({ summary: 'Declines the feedback with an optional reason (Admin)' })
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectFeedbackDto,
  ) {
    return this.feedback.reject(id, dto.reason);
  }
}
