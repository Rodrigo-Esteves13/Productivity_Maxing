import { registerDecorator, type ValidationOptions } from 'class-validator';

interface StringMatrixLimits {
  maxRows: number;
  maxCols: number;
  maxCellLength: number;
}

// Valida uma matriz de texto (string[][]), o formato real em que o frontend
// envia as linhas de uma tabela do caderno. O class-validator nao valida
// arrays dentro de arrays com `each`, por isso a verificacao e feita aqui,
// com limites explicitos para o JSONB nao crescer sem controlo.
export function isStringMatrix(
  value: unknown,
  limits: StringMatrixLimits,
): boolean {
  if (!Array.isArray(value) || value.length > limits.maxRows) return false;
  return value.every(
    (row: unknown) =>
      Array.isArray(row) &&
      row.length <= limits.maxCols &&
      row.every(
        (cell: unknown) =>
          typeof cell === 'string' && cell.length <= limits.maxCellLength,
      ),
  );
}

export function IsStringMatrix(
  limits: StringMatrixLimits,
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      name: 'isStringMatrix',
      target: object.constructor,
      propertyName,
      options: {
        message: `${propertyName} must be an array of at most ${limits.maxRows} rows, each an array of at most ${limits.maxCols} text cells (max ${limits.maxCellLength} characters each)`,
        ...validationOptions,
      },
      validator: {
        validate: (value: unknown) => isStringMatrix(value, limits),
      },
    });
  };
}
