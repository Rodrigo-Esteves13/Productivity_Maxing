import { Transform, Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FLASHCARD_GRADES, type FlashcardGrade } from '../flashcard-schedule';
import {
  FLASHCARD_BACK_MAX,
  FLASHCARD_BULK_MAX,
  FLASHCARD_EASE_MAX,
  FLASHCARD_EASE_MIN,
  FLASHCARD_FRONT_MAX,
  FLASHCARD_STATE_COUNT_MAX,
} from '../flashcards.constants';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateFlashcardDto {
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(FLASHCARD_FRONT_MAX)
  front: string;

  @ApiProperty()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(FLASHCARD_BACK_MAX)
  back: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUUID()
  areaId?: string | null;
}

export class BulkFlashcardsDto {
  @ApiProperty({ type: () => [CreateFlashcardDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(FLASHCARD_BULK_MAX)
  @ValidateNested({ each: true })
  @Type(() => CreateFlashcardDto)
  cards: CreateFlashcardDto[];
}

export class UpdateFlashcardDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(FLASHCARD_FRONT_MAX)
  front?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(FLASHCARD_BACK_MAX)
  back?: string;

  // null desliga a cadeira.
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUUID()
  areaId?: string | null;
}

export class ReviewFlashcardDto {
  @ApiProperty({ enum: FLASHCARD_GRADES })
  @IsIn(FLASHCARD_GRADES)
  grade: FlashcardGrade;
}

// Estado de agenda anterior, para desfazer a ultima classificacao.
export class RestoreFlashcardDto {
  @ApiProperty()
  @IsDateString()
  dueAt: string;

  @ApiProperty()
  @IsInt()
  @Min(0)
  @Max(FLASHCARD_STATE_COUNT_MAX)
  intervalDays: number;

  @ApiProperty()
  @IsNumber()
  @Min(FLASHCARD_EASE_MIN)
  @Max(FLASHCARD_EASE_MAX)
  ease: number;

  @ApiProperty()
  @IsInt()
  @Min(0)
  @Max(FLASHCARD_STATE_COUNT_MAX)
  reps: number;

  @ApiProperty()
  @IsInt()
  @Min(0)
  @Max(FLASHCARD_STATE_COUNT_MAX)
  lapses: number;
}

export class ListFlashcardsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  areaId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  dueOnly?: boolean;
}
