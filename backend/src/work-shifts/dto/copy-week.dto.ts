import { IsIn, IsOptional, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DATE_KEY_PATTERN } from '../../common/date-key.util';
import { COPY_WEEK_MODES } from '../work-shifts.constants';
import type { CopyWeekMode } from '../work-shifts.constants';

export class CopyWeekDto {
  @ApiProperty({
    example: '2026-09-28',
    description: 'Monday of the week to copy from.',
  })
  @Matches(DATE_KEY_PATTERN, {
    message: 'fromWeekStart must be formatted YYYY-MM-DD.',
  })
  fromWeekStart: string;

  @ApiPropertyOptional({
    example: '2026-10-05',
    description:
      'Monday of the week to copy into. Required for one-off, ignored for fixed.',
  })
  @IsOptional()
  @Matches(DATE_KEY_PATTERN, {
    message: 'toWeekStart must be formatted YYYY-MM-DD.',
  })
  toWeekStart?: string;

  @ApiProperty({
    enum: COPY_WEEK_MODES,
    description:
      'one-off: copy as one-day shifts. fixed: make them repeat every week.',
  })
  @IsIn(COPY_WEEK_MODES)
  mode: CopyWeekMode;
}
