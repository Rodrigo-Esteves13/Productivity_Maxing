import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TASK_BULK_MAX } from '../tasks.constants';

// Shared by bulk endpoints that just need "which tasks" - currently
// bulk delete. Capped at TASK_BULK_MAX per request: generous for a manual
// multi-select in the UI, small enough that a single request can't be
// used to hammer the DB with an unbounded IN (...) clause.
export class BulkTaskIdsDto {
  @ApiProperty({
    type: [String],
    example: ['b3f1c2d4-...', 'a9e8d7c6-...'],
    description: `IDs of the tasks to act on (max ${TASK_BULK_MAX} per request).`,
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(TASK_BULK_MAX)
  @IsUUID('4', { each: true })
  ids!: string[];
}
