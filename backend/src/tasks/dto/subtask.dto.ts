import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const MAX_SUBTASKS_PER_TASK = 100;
export const MAX_SUBTASK_TITLE_LENGTH = 200;

export class CreateSubtaskDto {
  @ApiProperty({ example: 'Resolver a ficha 3' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_SUBTASK_TITLE_LENGTH)
  title: string;
}

// Usado ao duplicar uma task (copia a checklist toda de uma vez).
export class CreateSubtasksBulkDto {
  @ApiProperty({ example: ['Ler capítulo 1', 'Fazer resumo'] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_SUBTASKS_PER_TASK)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(MAX_SUBTASK_TITLE_LENGTH, { each: true })
  titles: string[];
}

export class UpdateSubtaskDto {
  @ApiPropertyOptional({ example: 'Resolver a ficha 4' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_SUBTASK_TITLE_LENGTH)
  title?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isDone?: boolean;
}

export class ReorderSubtasksDto {
  @ApiProperty({
    description: 'Todos os ids das subtasks da task, na nova ordem.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_SUBTASKS_PER_TASK)
  @IsString({ each: true })
  subtaskIds: string[];
}
