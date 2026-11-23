import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CursorPaginationDto } from '../../common/dto/cursor-pagination.dto';
import { USER_SEARCH_MAX_LENGTH } from '../users.constants';

// Sem limit/cursor/paginated a resposta continua a ser um array (ate ao teto
// de listOrPage); com cursor ou paginated=true vem { items, nextCursor }.
export class ListUsersQueryDto extends CursorPaginationDto {
  @ApiPropertyOptional({
    description: 'Search in name, email and friend code (case-insensitive)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(USER_SEARCH_MAX_LENGTH)
  q?: string;
}
