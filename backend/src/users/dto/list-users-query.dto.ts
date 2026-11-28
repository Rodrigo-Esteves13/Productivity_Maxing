import { IsEnum, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Role, UserStatus } from '@prisma/client';
import { CursorPaginationDto } from '../../common/dto/cursor-pagination.dto';
import {
  USER_JOINED_ORDERS,
  USER_SEARCH_MAX_LENGTH,
  USER_SORT_FIELDS,
  type UserJoinedOrder,
  type UserSortField,
} from '../users.constants';

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

  @ApiPropertyOptional({ enum: Role })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiPropertyOptional({ enum: UserStatus })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiPropertyOptional({
    enum: USER_JOINED_ORDERS,
    description:
      'Sort direction (default desc for the join date, asc for the name)',
  })
  @IsOptional()
  @IsIn(USER_JOINED_ORDERS)
  order?: UserJoinedOrder;

  @ApiPropertyOptional({
    enum: USER_SORT_FIELDS,
    description: 'Sort column (default joined)',
  })
  @IsOptional()
  @IsIn(USER_SORT_FIELDS)
  sort?: UserSortField;
}
