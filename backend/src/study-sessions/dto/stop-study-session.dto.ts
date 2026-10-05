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

export class StopStudySessionDto {
  @ApiPropertyOptional({
    example: 'Covered chapters 3-4, need to revisit integrals tomorrow',
    description:
      'Free-text note. If the session already had a note from start(), this replaces it.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @ApiPropertyOptional({
    example: '2026-10-05T14:32:00.000Z',
    description:
      'When the session really ended, if earlier than now (e.g. you left the desk and forgot to stop). Must be after the start and not in the future.',
  })
  @IsOptional()
  @IsDateString()
  endedAt?: string;

  @ApiPropertyOptional({ example: 4, description: 'Perceived focus, 1 to 5.' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  focusRating?: number;
}
