import { ApiPropertyOptional } from '@nestjs/swagger';
import { FeedbackCategory } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  FEEDBACK_LANGUAGE_MAX_LENGTH,
  FEEDBACK_PAGE_MAX,
  FEEDBACK_SEARCH_MAX_LENGTH,
  FEEDBACK_STATUS_FILTERS,
  type FeedbackStatusFilter,
} from '../feedback.constants';

// Sem nenhum parametro, GET /feedback devolve o array de sempre; com algum,
// devolve { total, items, counts, languages }.
export class QueryFeedbackDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(FEEDBACK_PAGE_MAX)
  take?: number;

  @ApiPropertyOptional({ enum: FEEDBACK_STATUS_FILTERS })
  @IsOptional()
  @IsIn(FEEDBACK_STATUS_FILTERS)
  status?: FeedbackStatusFilter;

  @ApiPropertyOptional({ enum: FeedbackCategory })
  @IsOptional()
  @IsEnum(FeedbackCategory)
  category?: FeedbackCategory;

  @ApiPropertyOptional({ example: 'pt' })
  @IsOptional()
  @IsString()
  @MaxLength(FEEDBACK_LANGUAGE_MAX_LENGTH)
  language?: string;

  @ApiPropertyOptional({
    description: 'Search in message, reply, page and author (case-insensitive)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(FEEDBACK_SEARCH_MAX_LENGTH)
  q?: string;
}
