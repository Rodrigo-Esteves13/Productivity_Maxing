import { IsOptional, IsString, MaxLength } from 'class-validator';
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
}
