import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { TasksModule } from '../tasks/tasks.module';
import { TaskPacksController } from './task-packs.controller';
import { TaskPacksService } from './task-packs.service';

@Module({
  imports: [PrismaModule, AuthModule, TasksModule],
  controllers: [TaskPacksController],
  providers: [TaskPacksService],
})
export class TaskPacksModule {}
