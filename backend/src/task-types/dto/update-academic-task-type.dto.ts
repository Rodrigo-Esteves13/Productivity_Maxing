import { PartialType, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateAcademicTaskTypeDto } from './create-academic-task-type.dto';

// Igual ao UpdateTaskTypeDto: sem key a omitir, PartialType já chega.
// taskTypeId fica opcional aqui - permite "mover" a subcategoria para
// outro TaskType pai, se um dia precisares disso na UI.
export class UpdateAcademicTaskTypeDto extends PartialType(
  CreateAcademicTaskTypeDto,
) {
  @ApiPropertyOptional({
    example: false,
    description: 'Deactivates without deleting (soft delete)',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
