import {
  IsString,
  IsNotEmpty,
  IsDateString,
  IsEnum,
  IsOptional,
  IsNumber,
  IsUrl,
  Min,
  Max,
} from 'class-validator';
import { Difficulty, ProgressStatus } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTaskDto {
  @ApiProperty({
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    description: 'Area ID (UUID)',
  })
  @IsString()
  @IsNotEmpty()
  areaId: string;

  @ApiProperty({
    example: 'Study Derivatives',
    description: 'Task title',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    example: '2026-06-30T14:00:00Z',
    description: 'Task date (ISO format)',
  })
  @IsDateString()
  @IsOptional()
  date: string;

  @ApiProperty({
    example: 'ACADEMICO',
    description:
      'Task type key (see GET /tasks/meta). Managed by admins in /admin/task-types.',
  })
  @IsString()
  @IsNotEmpty()
  type: string;

  @ApiPropertyOptional({
    example: 'FREQUENCIA',
    description:
      'Academic subcategory key (only when type = "ACADEMICO"). See GET /tasks/meta.',
  })
  @IsOptional()
  @IsString()
  academicType?: string;

  @ApiPropertyOptional({
    example: 'Limites, Derivadas',
    description: 'Topics to study',
  })
  @IsOptional()
  @IsString()
  topics?: string;

  @ApiPropertyOptional({
    example: 25.5,
    description: 'Weight toward final grade (%)',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  weightPercentage?: number;

  @ApiProperty({
    enum: Difficulty,
    example: Difficulty.MEDIUM,
    description: 'Perceived difficulty level',
  })
  @IsEnum(Difficulty)
  difficulty: Difficulty;

  @ApiPropertyOptional({
    enum: ProgressStatus,
    example: ProgressStatus.ON_TRACK,
    description: 'Current progress status',
  })
  @IsOptional()
  @IsEnum(ProgressStatus)
  progressStatus?: ProgressStatus;

  @ApiPropertyOptional({
    example: 'https://moodle.up.pt/curso123',
    description: 'Reference link',
  })
  @IsOptional()
  @IsUrl()
  referenceLink?: string;

  @ApiPropertyOptional({ example: 16.0, description: 'Target grade (0-20)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(20)
  targetGrade?: number;

  @ApiPropertyOptional({
    example: 14.5,
    description: 'Actual grade obtained (0-20)',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(20)
  realGrade?: number;
}
