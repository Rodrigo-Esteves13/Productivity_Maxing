import { PartialType, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreatePriorityDto } from './create-priority.dto';

// A key já nem sequer existe no CreatePriorityDto (é gerada pelo backend) -
// mesma razão que UpdateTaskTypeDto: o "nome" (label) muda à vontade, o
// identificador estável (key, escondido) nunca muda depois de criado.
export class UpdatePriorityDto extends PartialType(CreatePriorityDto) {
  @ApiPropertyOptional({
    example: false,
    description: 'Deactivates without deleting (soft delete)',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
