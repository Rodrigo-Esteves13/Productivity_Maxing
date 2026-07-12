import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

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
  olderThanDays?: number;
}
