import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsInt,
  Matches,
  ValidateIf,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ContractType, CommuteMode } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  MAX_BUFFER_MINUTES,
  MAX_DAYS_OFF,
  MAX_ADDRESS_LENGTH,
  MAX_LABEL_LENGTH,
} from '../work-shifts.constants';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateCommitmentDto {
  @ApiProperty({ example: 'Work' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_LABEL_LENGTH)
  name: string;

  @ApiProperty({ example: 25, description: 'Travel minutes each way.' })
  @IsInt()
  @Min(0)
  @Max(MAX_BUFFER_MINUTES)
  commuteMinutes: number;

  @ApiPropertyOptional({ example: 'Rua Exemplo 5, Porto', nullable: true })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(MAX_ADDRESS_LENGTH)
  address?: string;

  @ApiPropertyOptional({ enum: CommuteMode })
  @IsOptional()
  @IsEnum(CommuteMode)
  commuteMode?: CommuteMode;

  @ApiPropertyOptional({
    example: [0, 6],
    description:
      'Fixed days off at this place: 0=Sunday..6=Saturday. Weekly shifts are never created on these days.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_DAYS_OFF)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  daysOff?: number[];

  @ApiPropertyOptional({ enum: ContractType, nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsEnum(ContractType)
  contractType?: ContractType | null;

  @ApiPropertyOptional({
    example: '2027-06-30',
    nullable: true,
    description: 'Last working day. Weekly shifts stop counting after it.',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'endsOn must be formatted YYYY-MM-DD.',
  })
  endsOn?: string | null;
}

export class UpdateCommitmentDto {
  @ApiPropertyOptional({ example: 'Work' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_LABEL_LENGTH)
  name?: string;

  @ApiPropertyOptional({ example: 30 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_BUFFER_MINUTES)
  commuteMinutes?: number;

  @ApiPropertyOptional({ example: 'Rua Exemplo 5, Porto', nullable: true })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(MAX_ADDRESS_LENGTH)
  address?: string;

  @ApiPropertyOptional({ enum: CommuteMode })
  @IsOptional()
  @IsEnum(CommuteMode)
  commuteMode?: CommuteMode;

  @ApiPropertyOptional({
    example: [0, 6],
    description:
      'Fixed days off at this place: 0=Sunday..6=Saturday. Weekly shifts are never created on these days.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_DAYS_OFF)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  daysOff?: number[];

  @ApiPropertyOptional({ enum: ContractType, nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsEnum(ContractType)
  contractType?: ContractType | null;

  @ApiPropertyOptional({
    example: '2027-06-30',
    nullable: true,
    description: 'Last working day. Weekly shifts stop counting after it.',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'endsOn must be formatted YYYY-MM-DD.',
  })
  endsOn?: string | null;
}

// Calcula (e guarda) o trajeto casa -> morada deste local. A origem e SEMPRE
// a homeAddress do proprio utilizador (nunca vem no pedido), por isso nao ha
// forma de usar o endpoint para consultar rotas arbitrarias entre moradas.
export class EstimateCommitmentCommuteDto {
  @ApiProperty({ example: 'Rua Exemplo 5, Porto' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_ADDRESS_LENGTH)
  address: string;

  @ApiProperty({ enum: CommuteMode })
  @IsEnum(CommuteMode)
  mode: CommuteMode;
}
