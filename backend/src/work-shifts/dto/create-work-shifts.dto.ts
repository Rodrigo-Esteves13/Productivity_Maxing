import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DATE_KEY_PATTERN } from '../../common/date-key.util';
import {
  MAX_BUFFER_MINUTES,
  MAX_LABEL_LENGTH,
  MAX_SHIFTS_PER_BATCH,
} from '../work-shifts.constants';

export class CreateWorkShiftDto {
  @ApiPropertyOptional({
    description:
      'Commitment (e.g. a workplace) this shift belongs to. Its name and commute time replace label/bufferMinutes.',
  })
  @IsOptional()
  @IsUUID()
  commitmentId?: string;

  @ApiPropertyOptional({
    example: 1,
    description:
      'Recurring weekly shift: 0=Sunday..6=Saturday. Send this OR date, never both.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek?: number;

  @ApiPropertyOptional({
    example: '2026-10-02',
    description: 'One-off shift on a specific day. Send this OR dayOfWeek.',
  })
  @IsOptional()
  @Matches(DATE_KEY_PATTERN, { message: 'date must be formatted YYYY-MM-DD.' })
  date?: string;

  @ApiProperty({ example: 540, description: 'Minutes since midnight, Lisbon.' })
  @IsInt()
  @Min(0)
  @Max(1439)
  startMinutes: number;

  @ApiProperty({
    example: 1020,
    description: 'Minutes since midnight, Lisbon.',
  })
  @IsInt()
  @Min(1)
  @Max(1440)
  endMinutes: number;

  @ApiPropertyOptional({
    example: 30,
    description: 'Travel/prep time blocked on each side of the shift.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_BUFFER_MINUTES)
  bufferMinutes?: number;

  @ApiPropertyOptional({ example: 'Cafe shift' })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_LABEL_LENGTH)
  label?: string;
}

export class CreateWorkShiftsDto {
  @ApiProperty({ type: [CreateWorkShiftDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_SHIFTS_PER_BATCH)
  @ValidateNested({ each: true })
  @Type(() => CreateWorkShiftDto)
  shifts: CreateWorkShiftDto[];
}
