import { IsString, IsNotEmpty, IsOptional, IsInt, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAcademicTaskTypeDto {
  @ApiProperty({
    example: 'TRABALHO_PRATICO',
    description: 'Identificador estável usado pelo código. Não editar depois de criado.',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z][A-Z0-9_]*$/, {
    message: 'key deve estar em MAIUSCULAS_COM_UNDERSCORE (ex: TRABALHO_PRATICO)',
  })
  key: string;

  @ApiProperty({ example: 'Trabalho Prático', description: 'Nome mostrado na interface' })
  @IsString()
  @IsNotEmpty()
  label: string;

  @ApiProperty({
    example: 'ACADEMICO',
    description: 'Key do TaskType pai a que esta subcategoria pertence',
  })
  @IsString()
  @IsNotEmpty()
  taskTypeKey: string;

  @ApiPropertyOptional({ example: 1, description: 'Ordem de apresentação no select' })
  @IsOptional()
  @IsInt()
  order?: number;
}
