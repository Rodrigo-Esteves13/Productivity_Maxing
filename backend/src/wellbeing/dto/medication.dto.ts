import {
  ArrayMaxSize,
  Equals,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MedicationSchedule } from '@prisma/client';
import { DATE_KEY_PATTERN } from '../../common/date-key.util';
import {
  LOCALE_PATTERN,
  MAX_INTAKE_NOTE_LENGTH,
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

  @ApiPropertyOptional({
    example: [480, 1260],
    description:
      'Daily times as minutes since midnight, Lisbon. Required (at least one) for DAILY, ignored for AS_NEEDED.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_TIMES_PER_MEDICATION)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(MINUTES_PER_DAY - 1, { each: true })
  times?: number[];

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  remindersEnabled?: boolean;

  @ApiPropertyOptional({ enum: MedicationSchedule, example: 'AS_NEEDED' })
  @IsOptional()
  @IsEnum(MedicationSchedule)
  schedule?: MedicationSchedule;
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
  @ArrayMaxSize(MAX_TIMES_PER_MEDICATION)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(MINUTES_PER_DAY - 1, { each: true })
  times?: number[];

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  remindersEnabled?: boolean;

  @ApiPropertyOptional({ enum: MedicationSchedule, example: 'AS_NEEDED' })
  @IsOptional()
  @IsEnum(MedicationSchedule)
  schedule?: MedicationSchedule;

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

export class CreateMedicationIntakeDto {
  @ApiProperty({ example: '6f1c0a1e-0000-4000-8000-000000000000' })
  @IsUUID()
  medicationId: string;

  @ApiProperty({ example: '2026-10-24T21:30:00.000Z' })
  @IsISO8601({ strict: true })
  takenAt: string;

  @ApiPropertyOptional({ example: '1 tablet' })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_MEDICATION_DOSAGE_LENGTH)
  dose?: string;

  @ApiPropertyOptional({ example: 'Before the exam' })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_INTAKE_NOTE_LENGTH)
  note?: string;
}

export class AcceptMedicationDisclaimerDto {
  @ApiProperty({
    example: 1,
    description: 'Version of the notice the user read and accepted.',
  })
  @IsInt()
  @Min(1)
  version: number;

  @ApiProperty({
    example: true,
    description:
      'The user confirms they are an adult where they live. Must be true.',
  })
  @Equals(true, { message: 'You must confirm you are an adult.' })
  adultConfirmed: boolean;

  @ApiProperty({
    example: 'pt',
    description: 'Language the notice was shown in.',
  })
  @Matches(LOCALE_PATTERN, {
    message: 'locale must look like "pt" or "pt-PT".',
  })
  locale: string;
}

export class MedicationIntakeRangeQueryDto {
  @ApiProperty({ example: '2026-10-18' })
  @Matches(DATE_KEY_PATTERN, { message: 'from must be formatted YYYY-MM-DD.' })
  from: string;

  @ApiProperty({ example: '2026-10-24' })
  @Matches(DATE_KEY_PATTERN, { message: 'to must be formatted YYYY-MM-DD.' })
  to: string;
}

export class MedicationHistoryQueryDto {
  @ApiProperty({ example: '2026-10-01' })
  @Matches(DATE_KEY_PATTERN, { message: 'from must be formatted YYYY-MM-DD.' })
  from: string;

  @ApiProperty({ example: '2026-10-31' })
  @Matches(DATE_KEY_PATTERN, { message: 'to must be formatted YYYY-MM-DD.' })
  to: string;
}
