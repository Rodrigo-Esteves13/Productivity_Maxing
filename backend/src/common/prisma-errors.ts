import { Prisma } from '@prisma/client';

// Codigos de erro do Prisma Client (PrismaClientKnownRequestError.code) que a
// app trata. Antes cada service definia a sua copia de 'P2002'.
export const PRISMA_UNIQUE_VIOLATION = 'P2002';
export const PRISMA_FOREIGN_KEY_VIOLATION = 'P2003';
export const PRISMA_RECORD_NOT_FOUND = 'P2025';

function prismaCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}

export function isUniqueViolation(error: unknown): boolean {
  return prismaCode(error) === PRISMA_UNIQUE_VIOLATION;
}

export function isForeignKeyViolation(error: unknown): boolean {
  return prismaCode(error) === PRISMA_FOREIGN_KEY_VIOLATION;
}

export function isNotFound(error: unknown): boolean {
  return prismaCode(error) === PRISMA_RECORD_NOT_FOUND;
}

/**
 * Resumo do erro para o log, sem os valores do pedido. A mensagem do Prisma
 * (sobretudo a de validacao) despeja os argumentos da query: notas, emails,
 * hashes de tokens. Fica so o codigo, o modelo e os campos do constraint, ou
 * a primeira linha da validacao ("Invalid `prisma.x.y()` invocation...").
 */
export function safePrismaSummary(exception: unknown): string {
  if (exception instanceof Prisma.PrismaClientKnownRequestError) {
    const meta = exception.meta ?? {};
    const parts = [exception.code];
    if (typeof meta.modelName === 'string') parts.push(meta.modelName);
    if (Array.isArray(meta.target)) parts.push(meta.target.join(','));
    if (typeof meta.target === 'string') parts.push(meta.target);
    return parts.join(' ');
  }
  if (exception instanceof Prisma.PrismaClientValidationError) {
    const firstLine =
      exception.message
        .split('\n')
        .map((line) => line.trim())
        .find((line) => line.length > 0) ?? '';
    return `${exception.name}: ${firstLine}`;
  }
  return exception instanceof Error ? exception.name : 'Unknown error';
}
