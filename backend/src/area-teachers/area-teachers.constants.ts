export const TEACHER_NAME_MAX_LENGTH = 100;

// Escritas (PUT/DELETE) por minuto na nota de docente.
export const AREA_TEACHER_WRITES_PER_MINUTE = 60;

/** Chave de comparacao de docentes: sem espacos nas pontas, sem maiusculas. */
export function teacherKey(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}
