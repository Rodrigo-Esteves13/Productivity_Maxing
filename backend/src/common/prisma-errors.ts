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
