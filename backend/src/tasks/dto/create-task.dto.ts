import {
  IsString,
  IsNotEmpty,
  IsDateString,
  IsEnum,
  IsOptional,
  IsNumber,
  IsInt,
  IsUrl,
  IsBoolean,
  Min,
  Max,
  MaxLength,
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
  @MaxLength(100)
  areaId: string;

  @ApiPropertyOptional({
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    description:
      'Período (semestre/ano) a que a task pertence. Opcional - se omitido, usa o período ativo do user (User.activePeriodId).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  periodId?: string;

  @ApiProperty({
    example: 'Study Derivatives',
    description: 'Task title',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
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
  @MaxLength(100)
  type: string;

  @ApiPropertyOptional({
    example: 'FREQUENCIA',
    description:
      'Academic subcategory key (only when type = "ACADEMICO"). See GET /tasks/meta.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  academicType?: string;

  @ApiPropertyOptional({
    example: 'Limits, Derivatives',
    description: 'Topics to study',
  })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  topics?: string;

  @ApiPropertyOptional({
    example: false,
    description: 'Whether this task is pinned to the top of every list',
  })
  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;

  @ApiPropertyOptional({
    example: 'Went well overall, but need to review integration by parts.',
    description: 'Free-form notes/journaling about the task',
  })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;

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
  @MaxLength(2048)
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

  @ApiPropertyOptional({
    example: 60,
    description:
      'Duration in minutes of the Google Calendar event, only used when the task has a time component (all-day events ignore this). Can span past midnight or across multiple days - the end is always start + duration, no special day-boundary handling. Defaults to 60 in CalendarService when not set.',
  })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(30 * 24 * 60)
  calendarDurationMinutes?: number;
}
