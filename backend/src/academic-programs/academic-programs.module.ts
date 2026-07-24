import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { ProgramsService } from './programs.service';
import { PeriodsService } from './periods.service';
import { ProgramsController } from './programs.controller';
import { PeriodsController } from './periods.controller';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [ProgramsController, PeriodsController],
  providers: [ProgramsService, PeriodsService],
  // Exported because TasksModule needs PeriodsService to resolve the
  // user's active period when creating a task without an explicit periodId.
  exports: [ProgramsService, PeriodsService],
})
export class AcademicProgramsModule {}
