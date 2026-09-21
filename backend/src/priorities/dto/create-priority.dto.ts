import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  IsHexColor,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Sem "key" aqui de propósito, mesma razão que CreateTaskTypeDto: o admin
// só escreve o nome, a key técnica é gerada automaticamente a partir dele
// (ver utils/generate-key.ts, reaproveitado de task-types/utils) e nunca
// é exposta para edição.
export class CreatePriorityDto {
  @ApiProperty({
    example: 'Urgent',
    description:
      'Name shown in the interface. You can edit this whenever you want.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  label: string;

  @ApiPropertyOptional({
    example: '#ef4444',
    description: 'Color in hexadecimal format',
  })
  @IsOptional()
  @IsHexColor()
  colorHex?: string;

  @ApiPropertyOptional({
    example: 3,
    description: 'Display order in the selects',
  })
  @IsOptional()
  @IsInt()
  order?: number;
}
