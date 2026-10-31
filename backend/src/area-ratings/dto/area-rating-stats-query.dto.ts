import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class AreaRatingStatsQueryDto {
  @ApiPropertyOptional({
    description:
      'Only count this period (must belong to the user). Defaults to all non-archived periods.',
  })
  @IsOptional()
  @IsUUID()
  periodId?: string;
}
