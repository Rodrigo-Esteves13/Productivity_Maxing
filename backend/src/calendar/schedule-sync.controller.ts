import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { ScheduleSyncService } from './schedule-sync.service';
import {
  DEFAULT_SYNC_DAYS,
  MAX_SYNC_DAYS,
  MIN_SYNC_DAYS,
  ScheduleSyncDto,
} from './dto/schedule-sync.dto';

@ApiTags('Calendar')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('calendar/schedule')
export class ScheduleSyncController {
  constructor(private readonly scheduleSyncService: ScheduleSyncService) {}

  // Só leitura: mostra o que um sync faria, sem tocar no Google Calendar.
  @Get('preview')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary:
      'Counts of events a sync would add, update and remove. Writes nothing.',
  })
  @ApiQuery({ name: 'days', required: false, example: 7 })
  preview(
    @CurrentUser() user: AuthenticatedUser,
    @Query('days') daysParam?: string,
  ) {
    // Clamp em vez de rejeitar, como no StudyPlanController.
    const parsed = Number(daysParam);
    const days = Number.isFinite(parsed)
      ? Math.min(Math.max(Math.trunc(parsed), MIN_SYNC_DAYS), MAX_SYNC_DAYS)
      : DEFAULT_SYNC_DAYS;
    return this.scheduleSyncService.preview(user.id, days);
  }

  @Post('sync')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @ApiOperation({
    summary:
      'Sends classes, work shifts, travel and suggested study blocks to Google Calendar. Only touches events this app created.',
  })
  sync(@CurrentUser() user: AuthenticatedUser, @Body() dto: ScheduleSyncDto) {
    return this.scheduleSyncService.sync(
      user.id,
      dto.days ?? DEFAULT_SYNC_DAYS,
    );
  }

  @Delete()
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @ApiOperation({
    summary:
      'Removes every event this app created in Google Calendar (never your own events).',
  })
  removeAll(@CurrentUser() user: AuthenticatedUser) {
    return this.scheduleSyncService.removeAll(user.id);
  }
}
