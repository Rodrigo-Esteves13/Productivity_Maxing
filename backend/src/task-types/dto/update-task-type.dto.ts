import { PartialType, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateTaskTypeDto } from './create-task-type.dto';

// A key já nem sequer existe no CreateTaskTypeDto (é gerada pelo backend),
// por isso não há nada a omitir aqui - PartialType herda só label/colorHex/
// order, todos livremente editáveis. É mesmo isto: o "nome" (label) muda
// à vontade, o identificador estável (key, escondido) nunca muda.
export class UpdateTaskTypeDto extends PartialType(CreateTaskTypeDto) {
  @ApiPropertyOptional({
    example: false,
    description: 'Desativa sem apagar (soft delete)',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
