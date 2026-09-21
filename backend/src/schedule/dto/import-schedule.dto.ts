import {
  IsString,
  IsNotEmpty,
  IsDateString,
  IsOptional,
  IsInt,
  Min,
  Max,
  MaxLength,
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Uma ocorrência de aula, já parseada do .ics no frontend (ver
 * utils/parseIcsSchedule.ts) - o backend nunca lê ficheiros .ics
 * diretamente, só recebe linhas já estruturadas. Mesmo padrão do import
 * de tasks (ImportTaskRowDto): parsing fica no cliente, o backend só
 * valida e grava.
 */
export class ImportScheduleRowDto {
  @ApiProperty({
    example: '2026-09-14T00:00:00.000Z',
    description:
      'Class date (day only matters here - the exact time lives in startMinutes/endMinutes below).',
  })
  @IsDateString()
  date: string;

  @ApiProperty({
    example: 1035,
    description: 'Start time, minutes since midnight, Lisbon local time.',
  })
  @IsInt()
  @Min(0)
  @Max(1439)
  startMinutes: number;

  @ApiProperty({
    example: 1215,
    description: 'End time, minutes since midnight, Lisbon local time.',
  })
  @IsInt()
  @Min(1)
  @Max(1440)
  endMinutes: number;

  @ApiProperty({ example: 'Computação Móvel' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  subject: string;

  @ApiPropertyOptional({ example: 'A.Lab.1' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  location?: string;

  @ApiPropertyOptional({ example: 'Alexandre Valente Conceicao Pereira Sousa' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  professor?: string;

  @ApiProperty({
    example: '1212_1C4586_5_3_202609140615_202609140915',
    description:
      'The .ics VEVENT UID. Used as the upsert key ([userId, externalUid] unique constraint) so re-importing the same file, or a new export whose window overlaps the last one, never duplicates a row.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  externalUid: string;
}

export class ImportScheduleDto {
  @ApiProperty({ type: [ImportScheduleRowDto] })
  @IsArray()
  @ArrayMinSize(1)
  // Um semestre inteiro de aulas (5-6 UCs x ~15 semanas x 1-2 blocos)
  // cabe largamente aqui, mesmo lógica de bound que ImportTasksDto usa
  // contra um payload desproporcionado.
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => ImportScheduleRowDto)
  occurrences: ImportScheduleRowDto[];
}
