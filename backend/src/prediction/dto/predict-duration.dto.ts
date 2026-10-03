import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsEnum,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { Difficulty } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PredictDurationDto {
  @ApiProperty({
    example: 'ACADEMICO',
    description: 'Task type key (see GET /tasks/meta).',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  type: string;

  @ApiPropertyOptional({
    example: 'FREQUENCIA',
    description: 'Academic subcategory key (only when type = "ACADEMICO").',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  academicType?: string;

  @ApiProperty({ enum: Difficulty, example: Difficulty.MEDIUM })
  @IsEnum(Difficulty)
  difficulty: Difficulty;

  @ApiPropertyOptional({
    example: 25.5,
    description: 'Weight toward final grade (%)',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  weightPercentage?: number;

  @ApiPropertyOptional({
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    description:
      'ID of an existing task owned by the caller. When set, the response also reports actualMinutes (real time already logged against it via StudySession) - used by TaskDetailView. Omit when predicting for a task that does not exist yet (the create form).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  taskId?: string;

  @ApiPropertyOptional({
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    description:
      'Area (course) of a task that does not exist yet. Only used to look up the average time YOU spent on that Area; ignored when taskId is set (the stored task decides).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  areaId?: string;
}
