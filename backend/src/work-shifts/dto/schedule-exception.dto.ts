import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ScheduleExceptionKind } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DATE_KEY_PATTERN } from '../../common/date-key.util';
import { MAX_EXCEPTION_NOTE_LENGTH } from '../work-shifts.constants';

const MINUTES_PER_DAY = 24 * 60;

export class CreateScheduleExceptionDto {
  @ApiProperty({
    enum: ScheduleExceptionKind,
    description:
      'OFF = no shift on these days (day off, holidays). RETIME = the shift happens at another time.',
  })
  @IsEnum(ScheduleExceptionKind)
  kind: ScheduleExceptionKind;

  @ApiPropertyOptional({
    description: 'One weekly shift. RETIME needs this or commitmentId.',
  })
  @IsOptional()
  @IsUUID()
  shiftId?: string;

  @ApiPropertyOptional({
    description:
      'Every weekly shift of one place. Without shiftId and commitmentId, OFF covers every weekly shift.',
  })
  @IsOptional()
  @IsUUID()
  commitmentId?: string;

  @ApiProperty({ example: '2026-11-02' })
  @Matches(DATE_KEY_PATTERN, {
    message: 'startsOn must be formatted YYYY-MM-DD.',
  })
  startsOn: string;

  @ApiProperty({ example: '2026-11-08', description: 'Inclusive.' })
  @Matches(DATE_KEY_PATTERN, {
    message: 'endsOn must be formatted YYYY-MM-DD.',
  })
  endsOn: string;

  @ApiPropertyOptional({ example: 600 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MINUTES_PER_DAY)
  startMinutes?: number;

  @ApiPropertyOptional({ example: 1080 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MINUTES_PER_DAY)
  endMinutes?: number;

  @ApiPropertyOptional({ example: 'Summer holidays' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(MAX_EXCEPTION_NOTE_LENGTH)
  note?: string;
}
