import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export const NOTEBOOK_SEARCH_MAX_LENGTH = 200;

// forbidNonWhitelisted no ValidationPipe global: @Query() tem de declarar q.
export class SearchNotebookQueryDto {
  @ApiProperty({ example: 'derivadas', maxLength: NOTEBOOK_SEARCH_MAX_LENGTH })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  @IsString()
  @MaxLength(NOTEBOOK_SEARCH_MAX_LENGTH)
  q?: string;
}
