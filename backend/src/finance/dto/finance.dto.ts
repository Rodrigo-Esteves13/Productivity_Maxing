import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FinanceEntryKind, FinanceGoalKind } from '@prisma/client';
import {
  FINANCE_CATEGORIES,
  FINANCE_CURRENCIES,
  FINANCE_GOAL_NAME_MAX_LENGTH,
  FINANCE_NOTE_MAX_LENGTH,
  MAX_AMOUNT_CENTS,
} from '../finance.constants';
import { DATE_KEY_PATTERN } from '../../common/date-key.util';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class UpdateFinanceSettingsDto {
  @ApiPropertyOptional({ enum: FINANCE_CURRENCIES })
  @IsOptional()
  @IsIn(FINANCE_CURRENCIES)
  currency?: string;

  // Pode ser negativo (conta a descoberto).
  @ApiPropertyOptional({ example: 125000 })
  @IsOptional()
  @IsInt()
  @Min(-MAX_AMOUNT_CENTS)
  @Max(MAX_AMOUNT_CENTS)
  balanceCents?: number;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(0)
  @Max(MAX_AMOUNT_CENTS)
  monthlyBudgetCents?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(0)
  @Max(MAX_AMOUNT_CENTS)
  leisureBudgetCents?: number | null;
}

export class CreateFinanceEntryDto {
  @ApiProperty({ enum: FinanceEntryKind })
  @IsEnum(FinanceEntryKind)
  kind: FinanceEntryKind;

  @ApiProperty({ example: 4250 })
  @IsInt()
  @Min(1)
  @Max(MAX_AMOUNT_CENTS)
  amountCents: number;

  @ApiProperty({ enum: FINANCE_CATEGORIES })
  @IsIn(FINANCE_CATEGORIES)
  category: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(FINANCE_NOTE_MAX_LENGTH)
  note?: string;

  @ApiProperty({ example: '2026-10-28' })
  @Matches(DATE_KEY_PATTERN, { message: 'date must be formatted YYYY-MM-DD.' })
  date: string;

  // Repete-se todos os meses a partir de `date` (renda, salario).
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  recurring?: boolean;
}

export class CreateFinanceGoalDto {
  @ApiProperty({ enum: FinanceGoalKind })
  @IsEnum(FinanceGoalKind)
  kind: FinanceGoalKind;

  @ApiProperty({ example: 'Portatil novo' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(FINANCE_GOAL_NAME_MAX_LENGTH)
  name: string;

  @ApiProperty({ example: 90000 })
  @IsInt()
  @Min(1)
  @Max(MAX_AMOUNT_CENTS)
  targetCents: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_AMOUNT_CENTS)
  savedCents?: number;

  @ApiPropertyOptional({ example: '2027-06-30', nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Matches(DATE_KEY_PATTERN, {
    message: 'deadline must be formatted YYYY-MM-DD.',
  })
  deadline?: string | null;
}

export class UpdateFinanceGoalDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(FINANCE_GOAL_NAME_MAX_LENGTH)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_AMOUNT_CENTS)
  targetCents?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_AMOUNT_CENTS)
  savedCents?: number;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Matches(DATE_KEY_PATTERN, {
    message: 'deadline must be formatted YYYY-MM-DD.',
  })
  deadline?: string | null;
}
