import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

// Corrigir uma sessao ja terminada. So tempos, nota e concentracao: mudar a
// task ou a area de uma sessao antiga nao e preciso e abriria mais uma
// verificacao de posse.
export class UpdateStudySessionDto {
  @ApiPropertyOptional({ example: '2026-10-05T09:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  startedAt?: string;

  @ApiPropertyOptional({ example: '2026-10-05T10:30:00.000Z' })
  @IsOptional()
  @IsDateString()
  endedAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @ApiPropertyOptional({ example: 4 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  focusRating?: number;
}
