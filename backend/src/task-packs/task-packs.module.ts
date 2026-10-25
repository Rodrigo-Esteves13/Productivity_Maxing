import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { TasksModule } from '../tasks/tasks.module';
import { PushModule } from '../push/push.module';
import { TaskPacksController } from './task-packs.controller';
import { TaskPacksService } from './task-packs.service';
import { TaskPackSyncService } from './task-pack-sync.service';

@Module({
  imports: [PrismaModule, AuthModule, TasksModule, PushModule],
  controllers: [TaskPacksController],
  providers: [TaskPacksService, TaskPackSyncService],
})
export class TaskPacksModule {}
