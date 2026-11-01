import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  APPROVAL_PRESET_KEYS,
  APPROVAL_ROUNDINGS,
  APPROVAL_SCALE_LIMIT,
  MAX_BELOW_SECOND_THRESHOLD_LIMIT,
} from '../presets';
import type { ApprovalPresetKey } from '../presets';
import type { ApprovalRounding, CustomRuleKind } from '../approval-rules.types';
import {
  CUSTOM_RULES_MAX,
  CUSTOM_RULE_KINDS,
  CUSTOM_RULE_LABEL_MAX,
  CUSTOM_RULE_MAX_BELOW_LIMIT,
} from '../custom-rules.constants';

const GRADE_DECIMALS = { maxDecimalPlaces: 2 };

/**
 * Campo opcional mas NAO anulavel: so salta a validacao se faltar (undefined).
 * Com @IsOptional() o null passava e ia dar um 500 do Prisma nas colunas
 * NOT NULL.
 */
const OptionalNotNull = () => ValidateIf((_, value) => value !== undefined);

interface ScaleFields {
  scaleMin?: number;
  scaleMax?: number;
}

// So compara quando os dois lados vieram no body; o servico volta a validar
// depois de juntar com o preset/regras atuais.
function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** scaleMax tem de ser maior que scaleMin (se ambos vierem). */
function IsAboveScaleMin(options?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isAboveScaleMin',
      target: object.constructor,
      propertyName,
      options: {
        message: 'scaleMax must be greater than scaleMin.',
        ...options,
      },
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          const { scaleMin } = args.object as ScaleFields;
          if (!isFiniteNumber(value) || !isFiniteNumber(scaleMin)) return true;
          return value > scaleMin;
        },
      },
    });
  };
}

/** O valor tem de ficar dentro de [scaleMin, scaleMax] (dos lados que vierem). */
function IsWithinScale(options?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isWithinScale',
      target: object.constructor,
      propertyName,
      options: {
        message: `${propertyName} must be within the grade scale.`,
        ...options,
      },
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          if (!isFiniteNumber(value)) return true;
          const { scaleMin, scaleMax } = args.object as ScaleFields;
          if (isFiniteNumber(scaleMin) && value < scaleMin) return false;
          if (isFiniteNumber(scaleMax) && value > scaleMax) return false;
          return true;
        },
      },
    });
  };
}

const KIND_MAX_BELOW: CustomRuleKind = 'MAX_BELOW';

/** Texto vazio (ou so espacos) passa a null; o resto vem sem espacos nas pontas. */
const trimToNull = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};

/** Uma regra extra. maxBelow so existe (e e obrigatorio) em MAX_BELOW. */
export class CustomRuleDto {
  @ApiPropertyOptional({ enum: CUSTOM_RULE_KINDS })
  @IsIn(CUSTOM_RULE_KINDS)
  kind!: CustomRuleKind;

  @ApiPropertyOptional({ example: 8 })
  @IsNumber(GRADE_DECIMALS)
  @Min(0)
  @Max(APPROVAL_SCALE_LIMIT)
  threshold!: number;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Required for MAX_BELOW, must be null for GROUP_AVG_MIN.',
  })
  @ValidateIf(
    (o: CustomRuleDto) => o.kind === KIND_MAX_BELOW || o.maxBelow != null,
  )
  @IsInt()
  @Min(0)
  @Max(CUSTOM_RULE_MAX_BELOW_LIMIT)
  @IsNullForGroupAvg()
  maxBelow?: number | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Only components whose name contains this text. null = all.',
  })
  @Transform(trimToNull)
  @IsOptional()
  @IsString()
  @MaxLength(CUSTOM_RULE_LABEL_MAX)
  labelContains?: string | null;
}

/** maxBelow so faz sentido em MAX_BELOW. */
function IsNullForGroupAvg(options?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isNullForGroupAvg',
      target: object.constructor,
      propertyName,
      options: {
        message: 'maxBelow is only allowed for MAX_BELOW rules.',
        ...options,
      },
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          const { kind } = args.object as CustomRuleDto;
          return kind === KIND_MAX_BELOW || value == null;
        },
      },
    });
  };
}

/**
 * PUT das regras de um programa ou cadeira. Tudo opcional: o que faltar vem
 * do preset escolhido (presetKey) ou, sem preset, das regras ja gravadas e
 * por fim do preset generico. null desliga so as regras opcionais
 * (presetKey, componentMinGrade, secondThreshold, maxBelowSecondThreshold);
 * nos restantes campos null e rejeitado.
 */
export class UpsertApprovalRulesDto {
  @ApiPropertyOptional({ enum: APPROVAL_PRESET_KEYS, nullable: true })
  @IsOptional()
  @IsIn(APPROVAL_PRESET_KEYS)
  presetKey?: ApprovalPresetKey | null;

  @ApiPropertyOptional({ example: 0 })
  @OptionalNotNull()
  @IsNumber(GRADE_DECIMALS)
  @Min(0)
  @Max(APPROVAL_SCALE_LIMIT)
  scaleMin?: number;

  @ApiPropertyOptional({ example: 20 })
  @OptionalNotNull()
  @IsNumber(GRADE_DECIMALS)
  @Min(0)
  @Max(APPROVAL_SCALE_LIMIT)
  @IsAboveScaleMin()
  scaleMax?: number;

  @ApiPropertyOptional({
    example: 10,
    description: 'Final grade (after rounding) needed to pass.',
  })
  @OptionalNotNull()
  @IsNumber(GRADE_DECIMALS)
  @IsWithinScale()
  passMark?: number;

  @ApiPropertyOptional({ enum: APPROVAL_ROUNDINGS })
  @OptionalNotNull()
  @IsIn(APPROVAL_ROUNDINGS)
  rounding?: ApprovalRounding;

  @ApiPropertyOptional({
    nullable: true,
    description: 'No assessed component may be below this. null disables it.',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsNumber(GRADE_DECIMALS)
  @IsWithinScale()
  componentMinGrade?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsNumber(GRADE_DECIMALS)
  @IsWithinScale()
  secondThreshold?: number | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Max components below secondThreshold.',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(0)
  @Max(MAX_BELOW_SECOND_THRESHOLD_LIMIT)
  maxBelowSecondThreshold?: number | null;

  @ApiPropertyOptional()
  @OptionalNotNull()
  @IsBoolean()
  hasExamTrack?: boolean;

  @ApiPropertyOptional()
  @OptionalNotNull()
  @IsBoolean()
  hasResitTrack?: boolean;

  @ApiPropertyOptional({
    type: [CustomRuleDto],
    description: 'Extra rules on top of the fixed ones. [] clears them.',
  })
  @OptionalNotNull()
  @IsArray()
  @ArrayMaxSize(CUSTOM_RULES_MAX)
  @ValidateNested({ each: true })
  @Type(() => CustomRuleDto)
  customRules?: CustomRuleDto[];
}
