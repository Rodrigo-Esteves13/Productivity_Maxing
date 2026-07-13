import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { CalendarService } from './calendar.service';

@Controller('calendar')
@UseGuards(JwtAuthGuard)
export class CalendarController {
  constructor(
    private calendarService: CalendarService,
    private prisma: PrismaService,
  ) {}

  // Issue #34: consultado pelo frontend antes de mostrar qualquer botão de
  // sync (Dashboard) ou o CTA de connect (Profile).
  @Get('status')
  getStatus(@CurrentUser() user: AuthenticatedUser) {
    return this.calendarService.getStatus(user.id);
  }

  // Issues #35/#36/#37: cria ou atualiza o evento e grava o
  // googleCalendarEventId de volta na Task.
  @Post('tasks/:taskId/sync')
  async syncTask(
    @CurrentUser() user: AuthenticatedUser,
    @Param('taskId') taskId: string,
  ) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, userId: user.id },
      include: { area: true, taskType: true, academicType: true },
    });
    if (!task) {
      throw new NotFoundException(`Task not found or you don't have access.`);
    }

    const googleCalendarEventId = await this.calendarService.upsertEventForTask(
      user.id,
      task,
    );

    await this.prisma.task.update({
      where: { id: taskId, userId: user.id },
      data: { googleCalendarEventId },
    });

    return { googleCalendarEventId };
  }

  @Delete('tasks/:taskId/sync')
  async unsyncTask(
    @CurrentUser() user: AuthenticatedUser,
    @Param('taskId') taskId: string,
  ) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, userId: user.id },
    });
    if (!task) {
      throw new NotFoundException(`Task not found or you don't have access.`);
    }

    if (task.googleCalendarEventId) {
      await this.calendarService.deleteEventForTask(
        user.id,
        task.googleCalendarEventId,
      );
      await this.prisma.task.update({
        where: { id: taskId, userId: user.id },
        data: { googleCalendarEventId: null },
      });
    }

    return { googleCalendarEventId: null };
  }
}
