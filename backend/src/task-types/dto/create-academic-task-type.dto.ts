import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  IsUUID,
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
      'Nome mostrado na interface. Podes editar isto quando quiseres.',
  })
  @IsString()
  @IsNotEmpty()
  label: string;

  @ApiProperty({
    description: 'ID do TaskType pai a que esta subcategoria pertence',
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
