export const HTTP_CONFLICT = 409;

/** Codigo HTTP de um erro do axios, ou undefined se nao for um erro de resposta. */
export function getHttpStatus(error: unknown): number | undefined {
  return (error as { response?: { status?: number } } | null)?.response?.status;
}
