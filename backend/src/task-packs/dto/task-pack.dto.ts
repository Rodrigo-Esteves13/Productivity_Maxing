import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MAX_PACK_ITEMS, MAX_PACK_NAME_LENGTH } from '../task-packs.constants';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateTaskPackDto {
  @ApiProperty({ example: 'Redes - 2.º semestre' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_PACK_NAME_LENGTH)
  name: string;

  @ApiProperty({
    type: [String],
    description: 'Ids of YOUR OWN tasks to include.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_PACK_ITEMS)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  taskIds: string[];
}

export class ImportPackItemDto {
  @ApiProperty()
  @IsUUID()
  itemId: string;

  @ApiPropertyOptional({
    description:
      'Subject to use. Ignored for items of an official subject (those are fixed for everyone).',
  })
  @IsOptional()
  @IsUUID()
  areaId?: string;
}

export class ImportTaskPackDto {
  @ApiPropertyOptional({ description: 'Defaults to your active period.' })
  @IsOptional()
  @IsUUID()
  periodId?: string;

  @ApiProperty({ type: [ImportPackItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_PACK_ITEMS)
  @ValidateNested({ each: true })
  @Type(() => ImportPackItemDto)
  items: ImportPackItemDto[];
}
