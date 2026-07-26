import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsEnum, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ProgressStatus } from '@prisma/client';

// Bulk equivalent of PATCH /tasks/:id with just { progressStatus }. Kept
// deliberately narrow (only this one field) instead of a generic bulk
// PATCH: mass-editing area/type/dates across unrelated tasks isn't a
// real use case, and a narrow DTO means no re-implementing the
// type/period resolution logic from update() for a bulk case that
// doesn't need it.
export class BulkUpdateStatusDto {
  @ApiProperty({
    type: [String],
    example: ['b3f1c2d4-...', 'a9e8d7c6-...'],
    description: 'IDs of the tasks to update (max 200 per request).',
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(200)
  @IsUUID('4', { each: true })
  ids!: string[];

  @ApiProperty({ enum: ProgressStatus, example: ProgressStatus.COMPLETED })
  @IsEnum(ProgressStatus)
  progressStatus!: ProgressStatus;
}
