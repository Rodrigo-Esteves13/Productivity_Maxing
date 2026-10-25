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
import {
  Difficulty,
  ProgressStatus,
  RecurrenceFrequency,
} from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Campos opcionais aceitam `null` (o @IsOptional deixa passar): no PATCH
// (UpdateTaskDto) null quer dizer "limpar este campo", undefined/ausente quer
// dizer "nao mexer". Ver TasksService.update.
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
  academicType?: string | null;

  @ApiPropertyOptional({
    example: 'Limits, Derivatives',
    description: 'Topics to study',
  })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  topics?: string | null;

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
  notes?: string | null;

  @ApiPropertyOptional({
    example: 25.5,
    description: 'Weight toward final grade (%)',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  weightPercentage?: number | null;

  @ApiPropertyOptional({
    example: 90,
    description:
      'How long you expect this task to take, in minutes. Purely informational on its own, and also the manual half of the duration-prediction feature: compared against real StudySession time and fed as a training feature for POST /predictions/duration.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(30 * 24 * 60)
  estimatedMinutes?: number | null;

  @ApiPropertyOptional({
    example: 480,
    description:
      'Rough study time in minutes, written from memory, for old tasks done before study sessions were logged. Only used when the task has no finished session. Feeds the duration, calibration and grade predictions.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(200 * 60)
  recalledStudyMinutes?: number | null;

  @ApiProperty({
    enum: Difficulty,
    example: Difficulty.MEDIUM,
    description: 'Perceived difficulty level',
  })
  @IsEnum(Difficulty)
  difficulty: Difficulty;

  @ApiPropertyOptional({
    example: 'HIGH',
    description:
      'Priority key (see GET /tasks/meta). Managed by admins in /admin/priorities. Manual urgency, independent of difficulty (e.g. an easy task can still be urgent). Omit for no priority set.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  priority?: string | null;

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
  referenceLink?: string | null;

  @ApiPropertyOptional({ example: 16.0, description: 'Target grade (0-20)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(20)
  targetGrade?: number | null;

  @ApiPropertyOptional({
    example: 14.5,
    description: 'Actual grade obtained (0-20)',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(20)
  realGrade?: number | null;

  @ApiPropertyOptional({
    example: 60,
    description:
      'Duration in minutes of the Google Calendar event, only used when the task has a time component (all-day events ignore this). Can span past midnight or across multiple days - the end is always start + duration, no special day-boundary handling. Defaults to 60 in CalendarService when not set.',
  })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(30 * 24 * 60)
  calendarDurationMinutes?: number | null;

  // Recorrência: ao CONCLUIR a task cria-se a próxima ocorrência. `null`
  // (no PATCH) desliga. Ver TasksService.spawnFollowUps.
  @ApiPropertyOptional({
    enum: RecurrenceFrequency,
    nullable: true,
    description:
      'Repeat when completed: DAILY, WEEKLY or MONTHLY. null = no repeat.',
  })
  @IsOptional()
  @IsEnum(RecurrenceFrequency)
  recurrenceFrequency?: RecurrenceFrequency | null;

  @ApiPropertyOptional({
    example: 1,
    description: 'Every N days/weeks/months.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  recurrenceInterval?: number;

  @ApiPropertyOptional({
    example: '2026-12-31T00:00:00Z',
    nullable: true,
    description:
      'Last date (inclusive) that still creates an occurrence. null = no end.',
  })
  @IsOptional()
  @IsDateString()
  recurrenceUntil?: string | null;
}
