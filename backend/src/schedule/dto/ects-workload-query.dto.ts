import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsUUID,
  registerDecorator,
  type ValidationOptions,
} from 'class-validator';
import { isRealDateKey } from '../ects-workload.util';

const DATE_KEY_MESSAGE = 'Send "from" and "to" as a real date, YYYY-MM-DD.';

// Data de calendario valida (a regex sozinha deixava passar 2026-13-01).
function IsRealDateKey(options?: ValidationOptions) {
  return (target: object, propertyName: string) => {
    registerDecorator({
      name: 'isRealDateKey',
      target: target.constructor,
      propertyName,
      options: { message: DATE_KEY_MESSAGE, ...options },
      validator: { validate: isRealDateKey },
    });
  };
}

export class EctsWorkloadQueryDto {
  @ApiProperty({ example: '2026-09-14' })
  @IsRealDateKey()
  from!: string;

  @ApiProperty({ example: '2027-01-31' })
  @IsRealDateKey()
  to!: string;

  @ApiPropertyOptional({
    description:
      'Only courses used in this period (must belong to the user). Without it: courses linked to the timetable or with study time in the range.',
  })
  @IsOptional()
  @IsUUID()
  periodId?: string;
}
