import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  IsHexColor,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTaskTypeDto {
  @ApiProperty({
    example: 'ACADEMICO',
    description:
      'Stable identifier used by the code (e.g. to show the academic subcategory select). UPPERCASE_WITH_UNDERSCORE. Do not edit after creation.',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z][A-Z0-9_]*$/, {
    message: 'key deve estar em MAIUSCULAS_COM_UNDERSCORE (ex: TAREFA_SIMPLES)',
  })
  key: string;

  @ApiProperty({
    example: 'Academic',
    description: 'Nome mostrado na interface',
  })
  @IsString()
  @IsNotEmpty()
  label: string;

  @ApiPropertyOptional({
    example: '#8b5cf6',
    description: 'Cor em formato Hexadecimal',
  })
  @IsOptional()
  @IsHexColor()
  colorHex?: string;

  @ApiPropertyOptional({
    example: 1,
    description: 'Display order in the selects',
  })
  @IsOptional()
  @IsInt()
  order?: number;
}
