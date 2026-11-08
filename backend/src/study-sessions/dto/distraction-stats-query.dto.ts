import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import {
  DISTRACTION_STATS_DEFAULT_DAYS,
  DISTRACTION_STATS_MAX_DAYS,
  DISTRACTION_STATS_MIN_DAYS,
} from '../distraction-stats.util';

export class DistractionStatsQueryDto {
  @ApiPropertyOptional({
    description: `Size of the window in days, today included (${DISTRACTION_STATS_MIN_DAYS}-${DISTRACTION_STATS_MAX_DAYS}). Defaults to ${DISTRACTION_STATS_DEFAULT_DAYS}.`,
    default: DISTRACTION_STATS_DEFAULT_DAYS,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(DISTRACTION_STATS_MIN_DAYS)
  @Max(DISTRACTION_STATS_MAX_DAYS)
  days?: number;
}
