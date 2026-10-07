import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Maximo de dias que a pergunta pode ser adiada (limite do DTO, nao so da UI).
export const OVERDUE_MAX_SNOOZE_DAYS = 30;

// Resposta do user ao prompt de "overdue check-in": esta task, que já
// passou o prazo, está de facto feita ou continua pendente?
export class ConfirmOverdueDto {
  @ApiProperty({
    example: true,
    description:
      'True if the task is actually done, false if it is still pending.',
  })
  @IsBoolean()
  isCompleted!: boolean;

  @ApiPropertyOptional({
    example: 14.5,
    description:
      'Grade obtained (0-20). Only applied when isCompleted is true; ignored otherwise.',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(20)
  realGrade?: number;

  @ApiPropertyOptional({
    example: 7,
    description:
      'Only for isCompleted=false: do not ask again for this many days (default: ask again tomorrow).',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(OVERDUE_MAX_SNOOZE_DAYS)
  snoozeDays?: number;
}
