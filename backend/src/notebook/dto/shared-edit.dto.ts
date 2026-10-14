import {
  ArrayMaxSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { UsefulLinkDto } from './upsert-notebook-entry.dto';

// O que um editor/co-owner pode mexer numa entrada partilhada: so o texto
// (titulo, notas, links uteis). Quadro branco, tabelas, fotos e anexos
// continuam so do dono - mexer nisso por uma partilha exigiria um editor
// completo fora da conta do dono.
export class SharedEditDto {
  @ApiPropertyOptional({ example: 'Aula 12 - normalizacao' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50000)
  textContent?: string;

  @ApiPropertyOptional({ type: [UsefulLinkDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => UsefulLinkDto)
  usefulLinks?: UsefulLinkDto[];

  @ApiPropertyOptional({
    description: 'Message for the owner (only used when proposing changes).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}
