import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DATE_KEY_PATTERN } from '../../common/date-key.util';
import {
  MAX_MOOD_NOTE_LENGTH,
  RATING_MAX,
  RATING_MIN,
} from '../wellbeing.constants';

export class UpsertMoodDto {
  @ApiProperty({ example: 4, description: '1 (very low) to 5 (very good).' })
  @IsInt()
  @Min(RATING_MIN)
  @Max(RATING_MAX)
  mood: number;

  @ApiPropertyOptional({
    example: 3,
    description: '1 (drained) to 5 (full of energy).',
  })
  @IsOptional()
  @IsInt()
  @Min(RATING_MIN)
  @Max(RATING_MAX)
  energy?: number;

  @ApiPropertyOptional({
    example: 2,
    description: '1 (calm) to 5 (very stressed).',
  })
  @IsOptional()
  @IsInt()
  @Min(RATING_MIN)
  @Max(RATING_MAX)
  stress?: number;

  @ApiPropertyOptional({ example: 'Slept badly before the exam.' })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_MOOD_NOTE_LENGTH)
  note?: string;
}

export class MoodRangeQueryDto {
  @ApiProperty({ example: '2026-10-01' })
  @Matches(DATE_KEY_PATTERN, { message: 'from must be formatted YYYY-MM-DD.' })
  from: string;

  @ApiProperty({ example: '2026-10-31' })
  @Matches(DATE_KEY_PATTERN, { message: 'to must be formatted YYYY-MM-DD.' })
  to: string;
}

export class DateKeyParamDto {
  @Matches(DATE_KEY_PATTERN, { message: 'date must be formatted YYYY-MM-DD.' })
  date: string;
}
