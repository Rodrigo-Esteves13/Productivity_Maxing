import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
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
import { CommuteMode } from '@prisma/client';
import { DATE_KEY_PATTERN } from '../../common/date-key.util';
import {
  MAX_ADDRESS_LENGTH,
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

  @ApiPropertyOptional({
    example: '2026-11-02',
    description:
      'Weekly shifts only: first day the shift applies. Omit to apply from now on.',
  })
  @IsOptional()
  @Matches(DATE_KEY_PATTERN, {
    message: 'startsOn must be formatted YYYY-MM-DD.',
  })
  startsOn?: string;

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

  // Evento pontual: morada e meio de transporte para o itinerario do dia
  // (turnos de um local usam a morada do local).
  @ApiPropertyOptional({ example: 'Rua Exemplo 5, Porto' })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_ADDRESS_LENGTH)
  address?: string;

  @ApiPropertyOptional({ enum: CommuteMode })
  @IsOptional()
  @IsEnum(CommuteMode)
  commuteMode?: CommuteMode;
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
