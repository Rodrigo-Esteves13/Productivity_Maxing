import { Transform } from 'class-transformer';

// O Supabase Auth trata o email sem distinguir maiusculas, mas User.email e
// um String @unique normal (case-sensitive no Postgres). Normalizar sempre
// para minusculas (e sem espacos) evita uma segunda conta para
// "Rodrigo@x.pt" vs "rodrigo@x.pt". As linhas antigas com maiusculas nao sao
// reescritas: as procuras usam `mode: 'insensitive'`.
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// Decorator para DTOs (o ValidationPipe global corre com transform: true).
export function NormalizeEmail(): PropertyDecorator {
  return Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? normalizeEmail(value) : value,
  );
}

// Filtro Prisma para procurar um User por email sem distinguir maiusculas.
export function emailEquals(email: string) {
  return { equals: normalizeEmail(email), mode: 'insensitive' as const };
}
