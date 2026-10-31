import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsUUID,
  ValidateIf,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Effort } from '@prisma/client';

// Bulk equivalent of PATCH /tasks/:id with just { effort }. Same narrow shape
// as BulkUpdateStatusDto. null limpa o esforco (volta a "sem esforco").
export class BulkUpdateEffortDto {
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

  @ApiProperty({
    enum: Effort,
    nullable: true,
    example: Effort.HEAVY,
    description: 'New effort, or null to clear it.',
  })
  @ValidateIf((_, value) => value !== null)
  @IsEnum(Effort)
  effort!: Effort | null;
}
