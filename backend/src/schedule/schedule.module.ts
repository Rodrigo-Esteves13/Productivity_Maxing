import { Module } from '@nestjs/common';
import { ScheduleService } from './schedule.service';
import { ItineraryService } from './itinerary.service';
import { ScheduleController } from './schedule.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { MapsModule } from '../maps/maps.module';

@Module({
  imports: [PrismaModule, AuthModule, MapsModule],
  controllers: [ScheduleController],
  providers: [ScheduleService, ItineraryService],
  // StudyPlanModule precisa de ler ocorrências de aulas para calcular
  // tempo livre - exporta o service em vez de duplicar a query lá.
  exports: [ScheduleService, ItineraryService],
})
export class ScheduleModule {}
