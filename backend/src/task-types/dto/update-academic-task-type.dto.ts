import { PartialType, OmitType, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateAcademicTaskTypeDto } from './create-academic-task-type.dto';

// Omite "key" pela mesma razão do UpdateTaskTypeDto.
export class UpdateAcademicTaskTypeDto extends PartialType(
  OmitType(CreateAcademicTaskTypeDto, ['key'] as const),
) {
  @ApiPropertyOptional({
    example: false,
    description: 'Desativa sem apagar (soft delete)',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
