import { Module } from '@nestjs/common';
import { TaskMetaCacheService } from './task-meta-cache.service';

@Module({
  providers: [TaskMetaCacheService],
  exports: [TaskMetaCacheService],
})
export class CommonModule {}
