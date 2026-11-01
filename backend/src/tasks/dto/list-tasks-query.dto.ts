import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CursorPaginationDto } from '../../common/dto/cursor-pagination.dto';

// periodId: omitido = período ativo; 'all' = todos; UUID = esse período
// (posse validada no service). Declarado aqui porque o ValidationPipe global
// usa forbidNonWhitelisted e @Query() recebe a query inteira.
export class ListTasksQueryDto extends CursorPaginationDto {
  @ApiPropertyOptional({ description: "Period id, or 'all'" })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  periodId?: string;

  @ApiPropertyOptional({ description: 'Only tasks carrying this tag' })
  @IsOptional()
  @IsString()
  @MaxLength(24)
  tag?: string;
}
