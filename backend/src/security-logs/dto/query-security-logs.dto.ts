import { IsIn, IsOptional, IsString } from 'class-validator';
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
  ip?: string;

  @ApiPropertyOptional({
    description: 'Filter by path (substring, case-insensitive)',
    example: '/auth/login',
  })
  @IsOptional()
  @IsString()
  path?: string;

  @ApiPropertyOptional({
    description: 'Relative time window to consider (default: all)',
    enum: ['1h', '24h', '7d'],
  })
  @IsOptional()
  @IsIn(['1h', '24h', '7d'])
  window?: '1h' | '24h' | '7d';
}
