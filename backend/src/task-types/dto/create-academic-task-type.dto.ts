import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Sem "key" aqui pela mesma razão do CreateTaskTypeDto - é gerada
// automaticamente a partir do label. taskTypeId (não taskTypeKey) porque o
// admin escolhe o TaskType pai a partir de uma lista já carregada na UI,
// que já tem o id à mão - não faz sentido obrigar a passar pela key.
export class CreateAcademicTaskTypeDto {
  @ApiProperty({
    example: 'Practical Assignment',
    description:
      'Name shown in the interface. You can edit this whenever you want.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  label: string;

  @ApiProperty({
    description: 'ID of the parent TaskType this subcategory belongs to',
  })
  @IsUUID()
  taskTypeId: string;

  @ApiPropertyOptional({
    example: 1,
    description: 'Display order in the select',
  })
  @IsOptional()
  @IsInt()
  order?: number;
}
