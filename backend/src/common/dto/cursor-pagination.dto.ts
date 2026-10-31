import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export const CURSOR_MAX_LIMIT = 200;
export const CURSOR_MAX_LENGTH = 64;

// Paginação por cursor (id da última linha). Diferente de PaginationDto
// (skip/take, usado no admin): cursor não degrada em páginas fundas e não
// salta/repete linhas se entrarem registos novos entre pedidos.
// Todos os campos são opcionais: sem nenhum, o endpoint devolve o mesmo
// array de sempre (ver listOrPage em common/pagination.util.ts).
export class CursorPaginationDto {
  @ApiPropertyOptional({
    example: 50,
    description: `Page size (1-${CURSOR_MAX_LIMIT})`,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(CURSOR_MAX_LIMIT)
  limit?: number;

  @ApiPropertyOptional({
    description:
      'nextCursor of the previous page; when sent, the response is { items, nextCursor }',
  })
  @IsOptional()
  @IsString()
  @MaxLength(CURSOR_MAX_LENGTH)
  cursor?: string;

  @ApiPropertyOptional({
    description:
      'true = respond with { items, nextCursor } from the first page (needed to obtain the first cursor)',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' || value === true
      ? true
      : value === 'false' || value === false
        ? false
        : value,
  )
  @IsBoolean()
  paginated?: boolean;
}
