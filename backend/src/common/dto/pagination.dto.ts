import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

// Base comum para qualquer listagem paginada por skip/take (ver
// QuerySecurityLogsDto e QueryAppealsDto). Extraído quando apareceu o
// segundo consumidor - com um único uso não valia a pena a abstração.
export class PaginationDto {
  @ApiPropertyOptional({
    example: 0,
    description: 'How many records to skip (for pagination)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number = 0;

  @ApiPropertyOptional({
    example: 25,
    description: 'How many records to return (max 100)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  take?: number = 25;
}
