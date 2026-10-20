import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsUUID,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

// Bulk equivalent of PATCH /tasks/:id with just { date }: "move these
// overdue tasks to today/tomorrow" from the Dashboard multi-select. Same
// 200-id cap as the other bulk DTOs.
export class BulkRescheduleDto {
  @ApiProperty({
    type: [String],
    example: ['b3f1c2d4-...', 'a9e8d7c6-...'],
    description: 'IDs of the tasks to move (max 200 per request).',
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(200)
  @IsUUID('4', { each: true })
  ids!: string[];

  @ApiProperty({
    example: '2026-10-21T00:00:00.000Z',
    description: 'New task date (ISO format).',
  })
  @IsDateString()
  date!: string;
}
