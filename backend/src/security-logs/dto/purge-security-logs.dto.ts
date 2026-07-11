import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class PurgeSecurityLogsDto {
  @ApiPropertyOptional({
    example: 30,
    description:
      'Apaga só logs mais antigos que N dias. Omitido = apaga TODOS os logs (usa com cuidado).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  olderThanDays?: number;
}
