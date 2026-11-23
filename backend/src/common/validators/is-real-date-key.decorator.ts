import { registerDecorator, type ValidationOptions } from 'class-validator';
import { isRealDateKey } from '../date-key.util';

// Data de calendario valida "YYYY-MM-DD" (a regex sozinha deixava passar
// 2026-13-01 e 2026-02-31).
export function IsRealDateKey(options?: ValidationOptions) {
  return (target: object, propertyName: string) => {
    registerDecorator({
      name: 'isRealDateKey',
      target: target.constructor,
      propertyName,
      options: {
        message: `${propertyName} must be a real date, YYYY-MM-DD.`,
        ...options,
      },
      validator: { validate: isRealDateKey },
    });
  };
}
