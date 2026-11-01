import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import {
  ApiProperty,
  ApiPropertyOptional,
  OmitType,
  PartialType,
} from '@nestjs/swagger';
import {
  FinanceAccountType,
  FinanceEntryKind,
  FinanceFrequency,
  FinanceGoalKind,
  FinancePayDayRule,
} from '@prisma/client';
import {
  ANALYTICS_GRANULARITIES,
  FINANCE_ACCOUNT_NAME_MAX_LENGTH,
  FINANCE_CATEGORIES,
  FINANCE_CURRENCIES,
  FINANCE_GOAL_NAME_MAX_LENGTH,
  FINANCE_HOLDING_NAME_MAX_LENGTH,
  FINANCE_NOTE_MAX_LENGTH,
  MAX_AMOUNT_CENTS,
  MAX_PAY_DAY,
  MIN_PAY_DAY,
  QUANTITY_PATTERN,
  QUOTE_SYMBOL_MAX_LENGTH,
  QUOTE_SYMBOL_PATTERN,
  type AnalyticsGranularity,
} from '../finance.constants';
import { DATE_KEY_PATTERN } from '../../common/date-key.util';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const upperTrim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;
const DATE_MESSAGE = (field: string) =>
  `${field} must be formatted YYYY-MM-DD.`;

export class UpdateFinanceSettingsDto {
  @ApiPropertyOptional({ enum: FINANCE_CURRENCIES })
  @IsOptional()
  @IsIn(FINANCE_CURRENCIES)
  currency?: string;

  // Legado (antes das contas): pode ser negativo (a descoberto). Preferir
  // FinanceAccount; ver finance.contract.ts.
  @ApiPropertyOptional({ example: 125000, deprecated: true })
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

  // Legado: true = MONTHLY no dia de `date`. `frequency` ganha se vierem os dois.
  @ApiPropertyOptional({ deprecated: true })
  @IsOptional()
  @IsBoolean()
  recurring?: boolean;

  // null/ausente = acontece uma vez.
  @ApiPropertyOptional({ enum: FinanceFrequency, nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsEnum(FinanceFrequency)
  frequency?: FinanceFrequency | null;

  // So com frequency MONTHLY. null = mesmo dia de `date`.
  @ApiPropertyOptional({ enum: FinancePayDayRule, nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsEnum(FinancePayDayRule)
  payDayRule?: FinancePayDayRule | null;

  // So com payDayRule FIXED_DAY. Cortado ao fim de meses curtos.
  @ApiPropertyOptional({
    minimum: MIN_PAY_DAY,
    maximum: MAX_PAY_DAY,
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(MIN_PAY_DAY)
  @Max(MAX_PAY_DAY)
  payDay?: number | null;

  // Ultimo dia (inclusive) com ocorrencias. Cancelar uma subscricao = por fim.
  @ApiPropertyOptional({ example: '2027-06-30', nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Matches(DATE_KEY_PATTERN, { message: DATE_MESSAGE('endDate') })
  endDate?: string | null;

  // So etiqueta: nao mexe no saldo da conta.
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  accountId?: string | null;
}

export class UpdateFinanceEntryDto extends PartialType(CreateFinanceEntryDto) {}

export class CreateFinanceAccountDto {
  @ApiProperty({ example: 'Revolut' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(FINANCE_ACCOUNT_NAME_MAX_LENGTH)
  name: string;

  @ApiProperty({ enum: FinanceAccountType })
  @IsEnum(FinanceAccountType)
  type: FinanceAccountType;

  // Dinheiro parado na conta (sem contar posicoes). Pode ser negativo.
  @ApiPropertyOptional({ example: 125000 })
  @IsOptional()
  @IsInt()
  @Min(-MAX_AMOUNT_CENTS)
  @Max(MAX_AMOUNT_CENTS)
  balanceCents?: number;

  // null = moeda das definicoes.
  @ApiPropertyOptional({ enum: FINANCE_CURRENCIES, nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsIn(FINANCE_CURRENCIES)
  currency?: string | null;
}

export class UpdateFinanceAccountDto extends PartialType(
  CreateFinanceAccountDto,
) {}

// Posicao: manda `quantity` OU `investedCents` (nunca os dois).
// Com investedCents a quantidade = investedCents / preco (priceCents ou a
// cotacao atual do fornecedor).
export class CreateFinanceHoldingDto {
  @ApiProperty({ example: 'VWCE.DE' })
  @Transform(upperTrim)
  @IsString()
  @MaxLength(QUOTE_SYMBOL_MAX_LENGTH)
  @Matches(QUOTE_SYMBOL_PATTERN, { message: 'symbol is not valid.' })
  symbol: string;

  // Vazio = o proprio simbolo.
  @ApiPropertyOptional({ example: 'Vanguard FTSE All-World' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(FINANCE_HOLDING_NAME_MAX_LENGTH)
  name?: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  accountId?: string | null;

  // Texto decimal, ate 6 casas (ex.: "0.666152").
  @ApiPropertyOptional({ example: '0.666152' })
  @IsOptional()
  @IsString()
  @Matches(QUANTITY_PATTERN, { message: 'quantity must be a decimal number.' })
  quantity?: string;

  @ApiPropertyOptional({ example: 11218 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_AMOUNT_CENTS)
  investedCents?: number;

  // Preco de uma unidade, se a pessoa o souber. Sem isto usa a cotacao.
  @ApiPropertyOptional({ example: 16840 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_AMOUNT_CENTS)
  priceCents?: number;

  // Quanto custou no total. Com investedCents e esse valor por omissao.
  @ApiPropertyOptional({ example: 11218, nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(0)
  @Max(MAX_AMOUNT_CENTS)
  costBasisCents?: number | null;
}

export class UpdateFinanceHoldingDto extends PartialType(
  OmitType(CreateFinanceHoldingDto, ['symbol'] as const),
) {}

export class FinanceAnalyticsQueryDto {
  @ApiPropertyOptional({ enum: ANALYTICS_GRANULARITIES })
  @IsOptional()
  @IsIn(ANALYTICS_GRANULARITIES)
  granularity?: AnalyticsGranularity;

  @ApiPropertyOptional({ example: '2026-05-01' })
  @IsOptional()
  @Matches(DATE_KEY_PATTERN, { message: DATE_MESSAGE('from') })
  from?: string;

  // Inclusive.
  @ApiPropertyOptional({ example: '2026-10-31' })
  @IsOptional()
  @Matches(DATE_KEY_PATTERN, { message: DATE_MESSAGE('to') })
  to?: string;
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
