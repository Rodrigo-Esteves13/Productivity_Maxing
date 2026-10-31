import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  Max,
  Min,
  ValidateIf,
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
import type { ApprovalRounding } from '../approval-rules.types';

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
}
