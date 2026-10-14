import {
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
import { Transform } from 'class-transformer';
import {
  ApiProperty,
  ApiPropertyOptional,
  PartialType,
  OmitType,
} from '@nestjs/swagger';
import {
  GRADE_AGGREGATIONS,
  MAX_COMPONENT_NAME_LENGTH,
} from '../grade-components.constants';
import type { GradeAggregationKind } from '../grade-components.constants';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateGradeComponentDto {
  @ApiProperty()
  @IsUUID()
  areaId: string;

  @ApiProperty()
  @IsUUID()
  periodId: string;

  @ApiProperty({ example: 'Weekly seminars' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_COMPONENT_NAME_LENGTH)
  name: string;

  @ApiProperty({ example: 15, description: 'Weight in the final grade (%).' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  weightPercentage: number;

  @ApiPropertyOptional({ enum: GRADE_AGGREGATIONS, default: 'AVERAGE' })
  @IsOptional()
  @IsIn(GRADE_AGGREGATIONS)
  aggregation?: GradeAggregationKind;

  @ApiPropertyOptional({
    description: 'With BEST_OF: how many top grades count.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  bestOfCount?: number;

  @ApiPropertyOptional({
    description: 'How many entries are expected in total.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  expectedEntries?: number;
}

// Area e periodo nunca mudam depois de criado (apagar e criar de novo).
export class UpdateGradeComponentDto extends PartialType(
  OmitType(CreateGradeComponentDto, ['areaId', 'periodId'] as const),
) {}
