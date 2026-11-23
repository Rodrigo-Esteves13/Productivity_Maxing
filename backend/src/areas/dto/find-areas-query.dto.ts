import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsUUID, ValidateIf } from 'class-validator';
import { ALL_PERIODS_QUERY_VALUE } from '../areas.constants';

export class FindAreasQueryDto {
  @ApiPropertyOptional({
    description:
      "Period id (annotates usedInPeriod) or 'all' for no annotation.",
  })
  @IsOptional()
  @ValidateIf((_o, value: unknown) => value !== ALL_PERIODS_QUERY_VALUE)
  @IsUUID()
  periodId?: string;

  @ApiPropertyOptional({
    description:
      'true = also returns official areas the caller turned off (Areas page)',
  })
  @IsOptional()
  @Transform(
    ({ value }: { value: unknown }) => value === true || value === 'true',
  )
  @IsBoolean()
  includeHidden?: boolean;
}
