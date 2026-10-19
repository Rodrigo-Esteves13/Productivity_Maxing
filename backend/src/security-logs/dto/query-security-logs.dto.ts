import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

const IP_FILTER_MAX_LENGTH = 45; // IPv6 completo
const PATH_FILTER_MAX_LENGTH = 200;
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../common/dto/pagination.dto';

// skip/take vêm de PaginationDto - também usado por QueryAppealsDto.
export class QuerySecurityLogsDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Filter by exact IP',
    example: '203.0.113.7',
  })
  @IsOptional()
  @IsString()
  @MaxLength(IP_FILTER_MAX_LENGTH)
  ip?: string;

  @ApiPropertyOptional({
    description: 'Filter by path (substring, case-insensitive)',
    example: '/auth/login',
  })
  @IsOptional()
  @IsString()
  @MaxLength(PATH_FILTER_MAX_LENGTH)
  path?: string;

  @ApiPropertyOptional({
    description: 'Relative time window to consider (default: all)',
    enum: ['1h', '24h', '7d'],
  })
  @IsOptional()
  @IsIn(['1h', '24h', '7d'])
  window?: '1h' | '24h' | '7d';
}
