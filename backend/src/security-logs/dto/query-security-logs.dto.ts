import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

// Não usamos PartialType/PaginationDto genérico porque isto é a única
// listagem paginada do backend até agora - criar uma abstração para um
// único uso só complicava sem ganho nenhum.
export class QuerySecurityLogsDto {
  @ApiPropertyOptional({
    example: 0,
    description: 'Quantos registos saltar (para paginação)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number = 0;

  @ApiPropertyOptional({
    example: 25,
    description: 'Quantos registos devolver (máx. 100)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  take?: number = 25;

  @ApiPropertyOptional({
    description: 'Filtra por IP exato',
    example: '203.0.113.7',
  })
  @IsOptional()
  @IsString()
  ip?: string;

  @ApiPropertyOptional({
    description: 'Filtra por path (substring, case-insensitive)',
    example: '/auth/login',
  })
  @IsOptional()
  @IsString()
  path?: string;

  @ApiPropertyOptional({
    description: 'Janela relativa a considerar (por omissão, tudo)',
    enum: ['1h', '24h', '7d'],
  })
  @IsOptional()
  @IsIn(['1h', '24h', '7d'])
  window?: '1h' | '24h' | '7d';
}
