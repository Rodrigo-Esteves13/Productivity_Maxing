import { Module } from '@nestjs/common';
import { StudyPlanService } from './study-plan.service';
import { StudyPlanController } from './study-plan.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { ScheduleModule } from '../schedule/schedule.module';
import { StudySessionsModule } from '../study-sessions/study-sessions.module';

@Module({
  imports: [PrismaModule, AuthModule, ScheduleModule, StudySessionsModule],
  controllers: [StudyPlanController],
  providers: [StudyPlanService],
})
export class StudyPlanModule {}
