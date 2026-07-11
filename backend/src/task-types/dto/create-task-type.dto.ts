import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  IsHexColor,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Sem "key" aqui de propósito: o admin só escreve o nome, a key técnica é
// gerada automaticamente a partir dele (ver utils/generate-key.ts) e nunca
// é exposta para edição - ver o comentário em UpdateTaskTypeDto.
export class CreateTaskTypeDto {
  @ApiProperty({
    example: 'Academic',
    description:
      'Nome mostrado na interface. Podes editar isto quando quiseres.',
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
