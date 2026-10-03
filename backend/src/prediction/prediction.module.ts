import { Module } from '@nestjs/common';
import { PredictionService } from './prediction.service';
import { PredictionController } from './prediction.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [PredictionController],
  providers: [PredictionService],
  // StudyPlanModule usa a previsão e a calibração para estimar as tasks.
  exports: [PredictionService],
})
export class PredictionModule {}
