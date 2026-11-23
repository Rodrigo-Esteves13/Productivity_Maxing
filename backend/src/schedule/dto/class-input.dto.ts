import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsRealDateKey } from '../../common/validators/is-real-date-key.decorator';
import {
  CLASS_LOCATION_MAX,
  CLASS_MAX_END_MINUTES,
  CLASS_MAX_START_MINUTES,
  CLASS_PROFESSOR_MAX,
  CLASS_SUBJECT_MAX,
} from '../schedule.constants';

// POST /schedule/class: uma aula criada a mao (sem .ics).
export class CreateClassDto {
  @ApiProperty({ example: '2026-09-14', description: 'Day, YYYY-MM-DD.' })
  @IsRealDateKey()
  date!: string;

  @ApiProperty({ example: 1035, description: 'Minutes since midnight.' })
  @IsInt()
  @Min(0)
  @Max(CLASS_MAX_START_MINUTES)
  startMinutes!: number;

  @ApiProperty({ example: 1215, description: 'Minutes since midnight.' })
  @IsInt()
  @Min(1)
  @Max(CLASS_MAX_END_MINUTES)
  endMinutes!: number;

  @ApiProperty({ example: 'Computação Móvel' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(CLASS_SUBJECT_MAX)
  subject!: string;

  @ApiPropertyOptional({ example: 'A.Lab.1' })
  @IsOptional()
  @IsString()
  @MaxLength(CLASS_LOCATION_MAX)
  location?: string;

  @ApiPropertyOptional({ example: 'Ana Sousa' })
  @IsOptional()
  @IsString()
  @MaxLength(CLASS_PROFESSOR_MAX)
  professor?: string;
}

// PATCH /schedule/:id: so os campos enviados mudam. location/professor
// vazios limpam o campo.
export class UpdateClassDto {
  @ApiPropertyOptional({ example: '2026-09-14' })
  @IsOptional()
  @IsRealDateKey()
  date?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(CLASS_MAX_START_MINUTES)
  startMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(CLASS_MAX_END_MINUTES)
  endMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(CLASS_SUBJECT_MAX)
  subject?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(CLASS_LOCATION_MAX)
  location?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(CLASS_PROFESSOR_MAX)
  professor?: string;
}
