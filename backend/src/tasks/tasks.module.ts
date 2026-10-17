import { Module } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { SubtasksService } from './subtasks.service';
import { SubtasksController } from './subtasks.controller';
import { WeeklyReviewService } from './weekly-review.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { AcademicProgramsModule } from '../academic-programs/academic-programs.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [PrismaModule, AuthModule, AcademicProgramsModule, CommonModule],
  controllers: [TasksController, SubtasksController],
  providers: [TasksService, SubtasksService, WeeklyReviewService],
  // TaskPacksModule cria tasks pela mesma TasksService.create (regras iguais).
  exports: [TasksService],
})
export class TasksModule {}
