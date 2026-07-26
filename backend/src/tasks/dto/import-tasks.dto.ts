import {
  IsString,
  IsNotEmpty,
  IsDateString,
  IsEnum,
  IsOptional,
  IsNumber,
  Min,
  Max,
  MaxLength,
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Difficulty, ProgressStatus } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * One row of an Excel/CSV import (see ImportTasksDto below). Deliberately
 * close to CreateTaskDto - same fields, same limits - but with
 * `difficulty`/`progressStatus` optional (defaulted in TasksService) since
 * a spreadsheet column for "perceived difficulty" is something most users
 * won't bother filling in for every row, and it shouldn't block an
 * otherwise-good import.
 */
export class ImportTaskRowDto {
  @ApiProperty({
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    description:
      'Area ID (UUID). Resolved client-side from the Area NAME column in the spreadsheet against GET /areas before this request is sent - the backend only ever sees IDs.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  areaId: string;

  @ApiPropertyOptional({
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    description:
      'Period ID. Optional - if omitted, uses the user\'s active period, same as POST /tasks.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  periodId?: string;

  @ApiProperty({ example: 'Study Derivatives', description: 'Task title' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @ApiProperty({
    example: '2026-06-30T00:00:00Z',
    description: 'Task date (ISO format). The frontend converts the spreadsheet cell to ISO before sending.',
  })
  @IsDateString()
  date: string;

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

  @ApiPropertyOptional({ example: 'Limits, Derivatives', description: 'Topics to study' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  topics?: string;

  @ApiPropertyOptional({ example: 25.5, description: 'Weight toward final grade (%)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  weightPercentage?: number;

  @ApiPropertyOptional({
    enum: Difficulty,
    example: Difficulty.MEDIUM,
    description: 'Perceived difficulty. Defaults to MEDIUM when the spreadsheet column is empty.',
  })
  @IsOptional()
  @IsEnum(Difficulty)
  difficulty?: Difficulty;

  @ApiPropertyOptional({
    enum: ProgressStatus,
    example: ProgressStatus.ON_TRACK,
    description: 'Current progress status. Defaults to ON_TRACK when omitted.',
  })
  @IsOptional()
  @IsEnum(ProgressStatus)
  progressStatus?: ProgressStatus;

  @ApiPropertyOptional({ example: 16.0, description: 'Target grade (0-20)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(20)
  targetGrade?: number;

  @ApiPropertyOptional({ example: 14.5, description: 'Actual grade obtained (0-20)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(20)
  realGrade?: number;
}

export class ImportTasksDto {
  @ApiProperty({
    type: [ImportTaskRowDto],
    description: 'Rows parsed from the uploaded spreadsheet, one per task to create.',
  })
  @IsArray()
  @ArrayMinSize(1)
  // Bounds the payload so a single request can't be used to hammer the DB
  // with an unbounded batch insert - matches the rate-limiting concern the
  // security audit flags for any bulk/expensive endpoint. A real spreadsheet
  // import is realistically a semester's worth of tasks, well under this.
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => ImportTaskRowDto)
  tasks: ImportTaskRowDto[];
}
