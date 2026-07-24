import { Module } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { AcademicProgramsModule } from '../academic-programs/academic-programs.module';

@Module({
  imports: [PrismaModule, AuthModule, AcademicProgramsModule],
  controllers: [TasksController],
  providers: [TasksService],
})
export class TasksModule {}
