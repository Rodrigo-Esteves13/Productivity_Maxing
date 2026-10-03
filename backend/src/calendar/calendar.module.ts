import { Module } from '@nestjs/common';
import { CalendarService } from './calendar.service';
import { CalendarController } from './calendar.controller';
import { ScheduleSyncService } from './schedule-sync.service';
import { ScheduleSyncController } from './schedule-sync.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { ScheduleModule } from '../schedule/schedule.module';
import { WorkShiftsModule } from '../work-shifts/work-shifts.module';
import { StudyPlanModule } from '../study-plan/study-plan.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    ScheduleModule,
    WorkShiftsModule,
    StudyPlanModule,
  ],
  controllers: [CalendarController, ScheduleSyncController],
  providers: [CalendarService, ScheduleSyncService],
})
export class CalendarModule {}
