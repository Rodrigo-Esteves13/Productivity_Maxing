import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsUUID,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TASK_BULK_MAX } from '../tasks.constants';

// Bulk equivalent of PATCH /tasks/:id with just { date }: "move these
// overdue tasks to today/tomorrow" from the Dashboard multi-select. Same
// TASK_BULK_MAX id cap as the other bulk DTOs.
export class BulkRescheduleDto {
  @ApiProperty({
    type: [String],
    example: ['b3f1c2d4-...', 'a9e8d7c6-...'],
    description: `IDs of the tasks to move (max ${TASK_BULK_MAX} per request).`,
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(TASK_BULK_MAX)
  @IsUUID('4', { each: true })
  ids!: string[];

  @ApiProperty({
    example: '2026-10-21T00:00:00.000Z',
    description: 'New task date (ISO format).',
  })
  @IsDateString()
  date!: string;
}
