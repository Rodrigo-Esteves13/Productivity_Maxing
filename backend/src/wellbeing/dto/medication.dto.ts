import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DATE_KEY_PATTERN } from '../../common/date-key.util';
import {
  MAX_MEDICATION_DOSAGE_LENGTH,
  MAX_MEDICATION_NAME_LENGTH,
  MAX_TIMES_PER_MEDICATION,
  MINUTES_PER_DAY,
} from '../wellbeing.constants';

export class CreateMedicationDto {
  @ApiProperty({ example: 'Vitamin D' })
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_MEDICATION_NAME_LENGTH)
  name: string;

  @ApiPropertyOptional({ example: '1 tablet' })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_MEDICATION_DOSAGE_LENGTH)
  dosage?: string;

  @ApiProperty({
    example: [480, 1260],
    description: 'Daily times as minutes since midnight, Lisbon.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_TIMES_PER_MEDICATION)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(MINUTES_PER_DAY - 1, { each: true })
  times: number[];

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  remindersEnabled?: boolean;
}

export class UpdateMedicationDto {
  @ApiPropertyOptional({ example: 'Vitamin D' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_MEDICATION_NAME_LENGTH)
  name?: string;

  @ApiPropertyOptional({ example: '1 tablet' })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_MEDICATION_DOSAGE_LENGTH)
  dosage?: string;

  @ApiPropertyOptional({ example: [480] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_TIMES_PER_MEDICATION)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(MINUTES_PER_DAY - 1, { each: true })
  times?: number[];

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  remindersEnabled?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class MedicationDoseDto {
  @ApiProperty({ example: '2026-10-21' })
  @Matches(DATE_KEY_PATTERN, { message: 'date must be formatted YYYY-MM-DD.' })
  date: string;

  @ApiProperty({ example: 480 })
  @IsInt()
  @Min(0)
  @Max(MINUTES_PER_DAY - 1)
  slotMinutes: number;

  @ApiProperty({
    example: true,
    description: 'true = taken, false = not taken.',
  })
  @IsBoolean()
  taken: boolean;
}

export class MedicationDayQueryDto {
  @ApiPropertyOptional({ example: '2026-10-21' })
  @IsOptional()
  @Matches(DATE_KEY_PATTERN, { message: 'date must be formatted YYYY-MM-DD.' })
  date?: string;
}
