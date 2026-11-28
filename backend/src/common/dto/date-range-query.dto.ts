import { ApiProperty } from '@nestjs/swagger';
import { registerDecorator, type ValidationOptions } from 'class-validator';
import { diffUtcDays, parseDateKey, isRealDateKey } from '../date-key.util';
import { IsRealDateKey } from '../validators/is-real-date-key.decorator';

// Teto de dias (inclusive) de um intervalo from..to: poe um limite ao
// trabalho de BD por pedido.
export const DATE_RANGE_MAX_DAYS = 400;

// `to` nao pode ficar mais de DATE_RANGE_MAX_DAYS depois de `from`.
// from > to continua a passar (devolve vazio, como antes). Datas invalidas
// ficam para o IsRealDateKey de cada campo.
function IsWithinRangeOf(fromProperty: string, options?: ValidationOptions) {
  return (target: object, propertyName: string) => {
    registerDecorator({
      name: 'isWithinDateRange',
      target: target.constructor,
      propertyName,
      options: {
        message: `The range cannot exceed ${DATE_RANGE_MAX_DAYS} days.`,
        ...options,
      },
      validator: {
        validate(value: unknown, args) {
          const from = (args?.object as Record<string, unknown>)[fromProperty];
          if (!isRealDateKey(from) || !isRealDateKey(value)) return true;
          return (
            diffUtcDays(parseDateKey(from), parseDateKey(value)) + 1 <=
            DATE_RANGE_MAX_DAYS
          );
        },
      },
    });
  };
}

export class DateRangeQueryDto {
  @ApiProperty({ example: '2026-09-14' })
  @IsRealDateKey()
  from!: string;

  @ApiProperty({ example: '2026-09-20' })
  @IsRealDateKey()
  @IsWithinRangeOf('from')
  to!: string;
}
