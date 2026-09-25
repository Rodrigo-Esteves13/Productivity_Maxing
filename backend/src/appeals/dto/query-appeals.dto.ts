import { IsIn, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../common/dto/pagination.dto';

// skip/take vêm de PaginationDto (mesma base que QuerySecurityLogsDto).
export class QueryAppealsDto extends PaginationDto {
  @ApiPropertyOptional({
    enum: ['pending', 'all'],
    description: 'Defaults to "pending" (unresolved only).',
  })
  @IsOptional()
  @IsIn(['pending', 'all'])
  status?: 'pending' | 'all';
}
