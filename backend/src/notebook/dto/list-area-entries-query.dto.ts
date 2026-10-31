import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CursorPaginationDto } from '../../common/dto/cursor-pagination.dto';

// areaId obrigatório (como antes, com ParseUUIDPipe); declarado aqui porque o
// ValidationPipe global usa forbidNonWhitelisted e @Query() recebe tudo.
export class ListAreaEntriesQueryDto extends CursorPaginationDto {
  @ApiProperty()
  @IsUUID()
  areaId!: string;
}
