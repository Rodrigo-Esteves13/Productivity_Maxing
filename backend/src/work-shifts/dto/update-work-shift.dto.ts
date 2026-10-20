import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CommuteMode } from '@prisma/client';
import { DATE_KEY_PATTERN } from '../../common/date-key.util';
import {
  MAX_ADDRESS_LENGTH,
  MAX_BUFFER_MINUTES,
  MAX_LABEL_LENGTH,
} from '../work-shifts.constants';

// Todos opcionais: só os campos enviados mudam. Enviar dayOfWeek OU date
// troca a recorrência (o outro fica a null); enviar os dois é um 400.
export class UpdateWorkShiftDto {
  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek?: number;

  @ApiPropertyOptional({ example: '2026-10-09' })
  @IsOptional()
  @Matches(DATE_KEY_PATTERN, { message: 'date must be formatted YYYY-MM-DD.' })
  date?: string;

  @ApiPropertyOptional({ example: 540 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1439)
  startMinutes?: number;

  @ApiPropertyOptional({ example: 1020 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1440)
  endMinutes?: number;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_BUFFER_MINUTES)
  bufferMinutes?: number;

  @ApiPropertyOptional({ example: 'Opening shift' })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_LABEL_LENGTH)
  label?: string;

  // null desliga o turno do local (volta a usar label/bufferMinutes).
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  commitmentId?: string | null;

  // Evento pontual: morada e meio de transporte para o itinerario do dia
  // (turnos de um local usam a morada do local).
  // Vazio apaga a morada.
  @ApiPropertyOptional({ example: 'Rua Exemplo 5, Porto' })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_ADDRESS_LENGTH)
  address?: string;

  @ApiPropertyOptional({ enum: CommuteMode })
  @IsOptional()
  @IsEnum(CommuteMode)
  commuteMode?: CommuteMode;
}
