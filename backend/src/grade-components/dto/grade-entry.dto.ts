import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  MAX_ENTRY_LABEL_LENGTH,
  MAX_GRADE_VALUE,
} from '../grade-components.constants';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateGradeEntryDto {
  @ApiProperty({ example: 16 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_GRADE_VALUE)
  grade: number;

  @ApiPropertyOptional({ example: 'Seminar 3' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(MAX_ENTRY_LABEL_LENGTH)
  label?: string;

  @ApiPropertyOptional({ example: '2026-10-13' })
  @IsOptional()
  @IsDateString()
  date?: string;
}

export class UpdateGradeEntryDto extends PartialType(CreateGradeEntryDto) {}
