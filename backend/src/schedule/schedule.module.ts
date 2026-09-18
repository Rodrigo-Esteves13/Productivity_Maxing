import { Module } from '@nestjs/common';
import { ScheduleService } from './schedule.service';
import { ScheduleController } from './schedule.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [ScheduleController],
  providers: [ScheduleService],
  // StudyPlanModule precisa de ler ocorrências de aulas para calcular
  // tempo livre - exporta o service em vez de duplicar a query lá.
  exports: [ScheduleService],
})
export class ScheduleModule {}
