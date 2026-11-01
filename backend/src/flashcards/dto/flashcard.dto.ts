import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FLASHCARD_GRADES, type FlashcardGrade } from '../flashcard-schedule';
import {
  FLASHCARD_BACK_MAX,
  FLASHCARD_FRONT_MAX,
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
