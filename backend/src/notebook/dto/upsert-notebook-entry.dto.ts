import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsDateString,
  IsArray,
  IsNumber,
  IsHexColor,
  Min,
  MaxLength,
  ValidateNested,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Um ponto de um traço. `pressure` é opcional (nem todo o rato/touchpad
// reporta pressão - só canetas/ecrãs sensíveis a isso) e nunca é usado
// para nada no backend, só passa direto para o frontend redesenhar o
// traço com a mesma espessura variável de quando foi feito.
export class StrokePointDto {
  @ApiProperty({ example: 120.5 })
  @IsNumber()
  x: number;

  @ApiProperty({ example: 340.2 })
  @IsNumber()
  y: number;

  @ApiPropertyOptional({ example: 0.8 })
  @IsOptional()
  @IsNumber()
  pressure?: number;
}

// Um traço completo (do pointerdown ao pointerup). Guardado vetorial, não
// rasterizado - ver comentário em NotebookEntry.drawingStrokes no schema.
export class StrokeDto {
  @ApiProperty({ type: [StrokePointDto] })
  @IsArray()
  // Um traço muito longo (rabisco contínuo sem levantar o rato) facilmente
  // passa de milhares de pontos - sem limite nenhum, um cliente malicioso
  // podia mandar um "traço" com milhões de pontos só para inchar o JSONB.
  @ArrayMaxSize(20000)
  @ValidateNested({ each: true })
  @Type(() => StrokePointDto)
  points: StrokePointDto[];

  @ApiProperty({ example: '#7C3AED' })
  @IsHexColor()
  color: string;

  @ApiProperty({ example: 2.5 })
  @IsNumber()
  @Min(0.5)
  width: number;
}

export class CreateNotebookEntryDto {
  @ApiProperty({ example: 'a1b2c3d4-...' })
  @IsUUID()
  areaId: string;

  @ApiPropertyOptional({
    example: 'a1b2c3d4-...',
    description:
      'ClassOccurrence detected as "happening now" when the entry was started (see GET /notebook/detect-class). Omit if there was no match.',
  })
  @IsOptional()
  @IsUUID()
  classOccurrenceId?: string;

  @ApiProperty({ example: 'Aula 12 de quinta, 18/09' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional({ example: 'Hoje vimos normalização até 3FN...' })
  @IsOptional()
  @IsString()
  @MaxLength(50000)
  textContent?: string;

  @ApiPropertyOptional({ type: [StrokeDto] })
  @IsOptional()
  @IsArray()
  // Um caderno de aula real facilmente tem centenas de traços; 5000 dá
  // margem larga sem deixar o payload crescer sem controlo nenhum.
  @ArrayMaxSize(5000)
  @ValidateNested({ each: true })
  @Type(() => StrokeDto)
  drawingStrokes?: StrokeDto[];

  @ApiProperty({ example: '2026-09-18T00:00:00.000Z' })
  @IsDateString()
  date: string;
}

// Igual ao create, mas tudo opcional (PATCH parcial) e sem areaId - mover
// uma entrada de cadeira depois de criada não é um caso de uso real
// (seria "esta aula afinal era de outra cadeira", melhor apagar e criar
// de novo do que arrastar fotos/traços entre Areas diferentes).
export class UpdateNotebookEntryDto {
  @ApiPropertyOptional({ example: 'Aula 12 de quinta, 18/09' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({ example: 'Hoje vimos normalização até 3FN...' })
  @IsOptional()
  @IsString()
  @MaxLength(50000)
  textContent?: string;

  @ApiPropertyOptional({ type: [StrokeDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5000)
  @ValidateNested({ each: true })
  @Type(() => StrokeDto)
  drawingStrokes?: StrokeDto[];

  @ApiPropertyOptional({ example: '2026-09-18T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  date?: string;
}
