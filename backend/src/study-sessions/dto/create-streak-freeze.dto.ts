import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';
import { DATE_KEY_PATTERN } from '../../common/date-key.util';

export class CreateStreakFreezeDto {
  @ApiPropertyOptional({
    description:
      'Lisbon day (YYYY-MM-DD) to rest on: today or yesterday. Defaults to today.',
    example: '2026-11-10',
  })
  @IsOptional()
  @IsString()
  @Matches(DATE_KEY_PATTERN)
  dateKey?: string;
}
