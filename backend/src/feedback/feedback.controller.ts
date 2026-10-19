import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsBoolean } from 'class-validator';
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
import { perMinute } from '../common/throttle.util';

class ResolveFeedbackDto {
  @IsBoolean()
  isResolved: boolean;
}

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
  @Patch(':id/resolved')
  setResolved(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolveFeedbackDto,
  ) {
    return this.feedback.setResolved(id, dto.isResolved);
  }
}
