import { Module } from '@nestjs/common';
import { StudyPlanService } from './study-plan.service';
import { StudyPlanController } from './study-plan.controller';
import { GradeProjectionService } from './grade-projection.service';
import { FocusEffectService } from './focus-effect.service';
import { PlanScenarioService } from './plan-scenario.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { ScheduleModule } from '../schedule/schedule.module';
import { StudySessionsModule } from '../study-sessions/study-sessions.module';
import { WorkShiftsModule } from '../work-shifts/work-shifts.module';
import { PredictionModule } from '../prediction/prediction.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    ScheduleModule,
    StudySessionsModule,
    WorkShiftsModule,
    PredictionModule,
  ],
  controllers: [StudyPlanController],
  providers: [
    StudyPlanService,
    GradeProjectionService,
    FocusEffectService,
    PlanScenarioService,
  ],
  // CalendarModule reutiliza o plano para enviar os blocos ao Google Calendar.
  exports: [StudyPlanService],
})
export class StudyPlanModule {}
