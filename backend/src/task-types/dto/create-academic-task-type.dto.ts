import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAcademicTaskTypeDto {
  @ApiProperty({
    example: 'TRABALHO_PRATICO',
    description:
      'Stable identifier used by the code. Do not edit after creation.',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z][A-Z0-9_]*$/, {
    message:
      'key deve estar em MAIUSCULAS_COM_UNDERSCORE (ex: TRABALHO_PRATICO)',
  })
  key: string;

  @ApiProperty({
    example: 'Practical Assignment',
    description: 'Nome mostrado na interface',
  })
  @IsString()
  @IsNotEmpty()
  label: string;

  @ApiProperty({
    example: 'ACADEMICO',
    description: 'Key do Parent TaskType a que esta subcategoria pertence',
  })
  @IsString()
  @IsNotEmpty()
  taskTypeKey: string;

  @ApiPropertyOptional({
    example: 1,
    description: 'Display order in the select',
  })
  @IsOptional()
  @IsInt()
  order?: number;
}
