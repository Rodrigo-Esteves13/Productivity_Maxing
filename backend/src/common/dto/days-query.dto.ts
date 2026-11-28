import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

// Query `?days=N` partilhada (janela em dias, hoje incluido). Antes cada
// controller fazia o seu Number()/clamp a mao, com defaults diferentes, e
// aceitava lixo como `days=1e9` ou `days=abc` em silencio.
export const DAYS_QUERY_MIN = 1;
export const DAYS_QUERY_MAX = 365;
export const DAYS_QUERY_DEFAULT = 30;

export interface DaysQueryOptions {
  defaultDays: number;
  maxDays: number;
  minDays?: number;
}

/**
 * Classe de query com limites proprios de cada rota. Uso:
 *   export class HistoryQueryDto extends createDaysQueryDto({ defaultDays: 14, maxDays: 90 }) {}
 * Fora dos limites (ou nao inteiro) responde 400; sem `days` usa o default.
 */
export function createDaysQueryDto({
  defaultDays,
  maxDays,
  minDays = DAYS_QUERY_MIN,
}: DaysQueryOptions) {
  class BoundedDaysQueryDto {
    @ApiPropertyOptional({
      description: `Size of the window in days, today included (${minDays}-${maxDays}). Defaults to ${defaultDays}.`,
      minimum: minDays,
      maximum: maxDays,
      default: defaultDays,
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(minDays)
    @Max(maxDays)
    days: number = defaultDays;
  }
  return BoundedDaysQueryDto;
}

// Versao generica (1 a DAYS_QUERY_MAX, default DAYS_QUERY_DEFAULT) para quem
// nao precisa de limites proprios.
export class DaysQueryDto extends createDaysQueryDto({
  defaultDays: DAYS_QUERY_DEFAULT,
  maxDays: DAYS_QUERY_MAX,
}) {}
