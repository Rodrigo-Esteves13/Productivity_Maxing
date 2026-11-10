import { Module } from '@nestjs/common';
import { StudySessionsService } from './study-sessions.service';
import { StudySessionsController } from './study-sessions.controller';
import { StreakFreezesService } from './streak-freezes.service';
import { StreakFreezesController } from './streak-freezes.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [StudySessionsController, StreakFreezesController],
  providers: [StudySessionsService, StreakFreezesService],
  // StudyPlanModule reaproveita getHeatmap() para preferir os blocos
  // horários onde o user historicamente estuda melhor, em vez de
  // duplicar a query de heatmap lá.
  exports: [StudySessionsService],
})
export class StudySessionsModule {}
