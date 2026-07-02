import {
  IsString,
  IsNotEmpty,
  IsDateString,
  IsEnum,
  IsOptional,
  IsNumber,
  IsUrl,
} from 'class-validator';
import {
  TaskType,
  AcademicTaskType,
  Difficulty,
  ProgressStatus,
} from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTaskDto {
  @ApiProperty({
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    description: 'ID da Área (UUID)',
  })
  @IsString()
  @IsNotEmpty()
  areaId: string;

  @ApiProperty({
    example: 'Estudar Derivadas',
    description: 'Título da tarefa',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    example: '2026-06-30T14:00:00Z',
    description: 'Data da tarefa (Formato ISO)',
  })
  @IsDateString()
  @IsOptional()
  date: string;

  @ApiProperty({
    enum: TaskType,
    example: TaskType.ACADEMICO,
    description: 'A categoria principal',
  })
  @IsEnum(TaskType)
  type: TaskType;

  @ApiPropertyOptional({
    enum: AcademicTaskType,
    example: AcademicTaskType.FREQUENCIA,
    description: 'Subcategoria (Apenas se type for ACADEMICO)',
  })
  @IsOptional()
  @IsEnum(AcademicTaskType)
  academicType?: AcademicTaskType;

  @ApiPropertyOptional({
    example: 'Limites, Derivadas',
    description: 'Tópicos a estudar',
  })
  @IsOptional()
  @IsString()
  topics?: string;

  @ApiPropertyOptional({ example: 25.5, description: 'Peso na nota final (%)' })
  @IsOptional()
  @IsNumber()
  weightPercentage?: number;

  @ApiProperty({
    enum: Difficulty,
    example: Difficulty.MEDIO,
    description: 'Nível de dificuldade percebido',
  })
  @IsEnum(Difficulty)
  difficulty: Difficulty;

  @ApiPropertyOptional({
    enum: ProgressStatus,
    example: ProgressStatus.TEMPO_ESPERADO,
    description: 'Estado do progresso atual',
  })
  @IsOptional()
  @IsEnum(ProgressStatus)
  progressStatus?: ProgressStatus;

  @ApiPropertyOptional({
    example: 'https://moodle.up.pt/curso123',
    description: 'Link de referência',
  })
  @IsOptional()
  @IsUrl()
  referenceLink?: string;

  @ApiPropertyOptional({ example: 16.0, description: 'Nota objetivo (0-20)' })
  @IsOptional()
  @IsNumber()
  targetGrade?: number;

  @ApiPropertyOptional({
    example: 14.5,
    description: 'Nota real obtida (0-20)',
  })
  @IsOptional()
  @IsNumber()
  realGrade?: number;
}
