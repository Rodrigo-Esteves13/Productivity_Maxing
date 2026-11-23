import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { Throttle } from '@nestjs/throttler';
import { perMinute } from '../common/throttle.util';
import { CalendarService } from './calendar.service';
import { CALENDAR_TASK_SYNCS_PER_MINUTE } from './schedule-sync.constants';

@Controller('calendar')
@UseGuards(JwtAuthGuard)
export class CalendarController {
  constructor(private calendarService: CalendarService) {}

  // Issue #34: consultado pelo frontend antes de mostrar qualquer botão de
  // sync (Dashboard) ou o CTA de connect (Profile).
  @Get('status')
  getStatus(@CurrentUser() user: AuthenticatedUser) {
    return this.calendarService.getStatus(user.id);
  }

  // Issues #35/#36/#37: cria ou atualiza o evento e grava o
  // googleCalendarEventId de volta na Task.
  @Post('tasks/:taskId/sync')
  @Throttle(perMinute(CALENDAR_TASK_SYNCS_PER_MINUTE))
  syncTask(
    @CurrentUser() user: AuthenticatedUser,
    @Param('taskId', ParseUUIDPipe) taskId: string,
  ) {
    return this.calendarService.syncTask(user.id, taskId);
  }

  @Delete('tasks/:taskId/sync')
  @Throttle(perMinute(CALENDAR_TASK_SYNCS_PER_MINUTE))
  unsyncTask(
    @CurrentUser() user: AuthenticatedUser,
    @Param('taskId', ParseUUIDPipe) taskId: string,
  ) {
    return this.calendarService.unsyncTask(user.id, taskId);
  }
}
