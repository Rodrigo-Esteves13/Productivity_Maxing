import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { SECURITY_LOGS_PURGE_MAX_DAYS } from '../security-logs.constants';

export class PurgeSecurityLogsDto {
  @ApiPropertyOptional({
    example: 30,
    description:
      'Deletes only logs older than N days. Omitted = deletes ALL logs (use with care).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(SECURITY_LOGS_PURGE_MAX_DAYS)
  olderThanDays?: number;
}
