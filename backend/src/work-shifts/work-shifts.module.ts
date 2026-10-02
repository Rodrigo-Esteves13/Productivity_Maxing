import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { WorkShiftsService } from './work-shifts.service';
import { WorkShiftsController } from './work-shifts.controller';
import { CommitmentsService } from './commitments.service';
import { CommitmentsController } from './commitments.controller';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [WorkShiftsController, CommitmentsController],
  providers: [WorkShiftsService, CommitmentsService],
  // StudyPlanModule expande os turnos para calcular tempo livre.
  exports: [WorkShiftsService],
})
export class WorkShiftsModule {}
