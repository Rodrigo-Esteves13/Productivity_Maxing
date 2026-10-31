import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import {
  ABSENCE_LIMIT_PCT_MAX,
  ABSENCE_LIMIT_PCT_MIN,
} from '../course-risk.constants';

export class CourseRiskQueryDto {
  @ApiPropertyOptional({
    description: `Absence limit in percent (${ABSENCE_LIMIT_PCT_MIN}-${ABSENCE_LIMIT_PCT_MAX}). Defaults to the app default.`,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(ABSENCE_LIMIT_PCT_MIN)
  @Max(ABSENCE_LIMIT_PCT_MAX)
  absenceLimitPct?: number;

  @ApiPropertyOptional({
    description:
      'Only count this period (must belong to the user). Defaults to all non-archived periods.',
  })
  @IsOptional()
  @IsUUID()
  periodId?: string;
}
