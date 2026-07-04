import { IsString, IsNotEmpty, IsOptional, IsInt, IsHexColor, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTaskTypeDto {
  @ApiProperty({
    example: 'ACADEMICO',
    description:
      'Identificador estável usado pelo código (ex: mostrar o select de subcategoria académica). MAIUSCULAS_COM_UNDERSCORE. Não editar depois de criado.',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z][A-Z0-9_]*$/, {
    message: 'key deve estar em MAIUSCULAS_COM_UNDERSCORE (ex: TAREFA_SIMPLES)',
  })
  key: string;

  @ApiProperty({ example: 'Académico', description: 'Nome mostrado na interface' })
  @IsString()
  @IsNotEmpty()
  label: string;

  @ApiPropertyOptional({ example: '#8b5cf6', description: 'Cor em formato Hexadecimal' })
  @IsOptional()
  @IsHexColor()
  colorHex?: string;

  @ApiPropertyOptional({ example: 1, description: 'Ordem de apresentação nos selects' })
  @IsOptional()
  @IsInt()
  order?: number;
}
