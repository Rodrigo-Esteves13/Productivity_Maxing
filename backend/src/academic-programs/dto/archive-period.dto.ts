import { IsOptional, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ArchivePeriodDto {
  @ApiPropertyOptional({
    example: false,
    description:
      "Explicit confirmation, only needed when this is the program's most recent period with no successor - see PeriodsService.archive().",
  })
  @IsOptional()
  @IsBoolean()
  confirm?: boolean;
}
