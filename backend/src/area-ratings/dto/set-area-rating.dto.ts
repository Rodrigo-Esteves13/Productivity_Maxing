import {
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { RATING_MAX, RATING_MIN } from '../area-ratings.constants';

const RATING_FIELDS = ['teacherRating', 'courseLiking'] as const;

/** Ausente = nao mexe; null = limpa; senao inteiro RATING_MIN-RATING_MAX. */
export function isRatingOrNull(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    (typeof value === 'number' &&
      Number.isInteger(value) &&
      value >= RATING_MIN &&
      value <= RATING_MAX)
  );
}

// Validadores proprios (sem IsOptional/ValidateIf): estes saltariam todas as
// regras da propriedade quando ela falta, incluindo a de "pelo menos um".
function IsRatingOrNull(options?: ValidationOptions) {
  return (target: object, propertyName: string) => {
    registerDecorator({
      name: 'isRatingOrNull',
      target: target.constructor,
      propertyName,
      options: {
        message: `${propertyName} must be an integer from ${RATING_MIN} to ${RATING_MAX}, or null.`,
        ...options,
      },
      validator: { validate: isRatingOrNull },
    });
  };
}

/** Pelo menos um dos campos tem de vir no corpo (pode ser null). */
function HasAtLeastOneRating(options?: ValidationOptions) {
  return (target: object, propertyName: string) => {
    registerDecorator({
      name: 'hasAtLeastOneRating',
      target: target.constructor,
      propertyName,
      options: {
        message: `Send at least one of: ${RATING_FIELDS.join(', ')}.`,
        ...options,
      },
      validator: {
        validate(_value: unknown, args: ValidationArguments) {
          const body = args.object as Record<string, unknown>;
          return RATING_FIELDS.some((field) => body[field] !== undefined);
        },
      },
    });
  };
}

export class SetAreaRatingDto {
  @ApiPropertyOptional({
    nullable: true,
    minimum: RATING_MIN,
    maximum: RATING_MAX,
    description: 'Teacher rating. null clears it, omitted keeps it.',
  })
  @HasAtLeastOneRating()
  @IsRatingOrNull()
  teacherRating?: number | null;

  @ApiPropertyOptional({
    nullable: true,
    minimum: RATING_MIN,
    maximum: RATING_MAX,
    description:
      'How much you liked the course. null clears it, omitted keeps it.',
  })
  @IsRatingOrNull()
  courseLiking?: number | null;
}
