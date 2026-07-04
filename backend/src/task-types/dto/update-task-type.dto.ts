import { PartialType, OmitType, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateTaskTypeDto } from './create-task-type.dto';

// Omite "key" de propósito: é o identificador que o código usa para lógica
// (ex: comparar com "ACADEMICO"), não deve poder ser alterado depois de criado.
// Se precisares mesmo de mudar a key, apaga e cria de novo.
export class UpdateTaskTypeDto extends PartialType(
  OmitType(CreateTaskTypeDto, ['key'] as const),
) {
  @ApiPropertyOptional({
    example: false,
    description: 'Desativa sem apagar (soft delete)',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
