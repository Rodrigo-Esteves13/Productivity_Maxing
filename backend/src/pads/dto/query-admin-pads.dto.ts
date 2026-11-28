import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ADMIN_PADS_PAGE_MAX, PAD_SLUG_MAX_LENGTH } from '../pads.constants';

export class QueryBlockedSourcesDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(ADMIN_PADS_PAGE_MAX)
  take?: number;
}

// GET /pads/admin/recent: sem parametros devolve o array de sempre; com
// algum, { total, items } sobre todos os pads.
export class QueryAdminPadsDto extends QueryBlockedSourcesDto {
  @ApiPropertyOptional({ description: 'Part of the pad name' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsString()
  @MaxLength(PAD_SLUG_MAX_LENGTH)
  q?: string;
}
