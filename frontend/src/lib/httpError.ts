export const HTTP_CONFLICT = 409;

/** Codigo HTTP de um erro do axios, ou undefined se nao for um erro de resposta. */
export function getHttpStatus(error: unknown): number | undefined {
  return (error as { response?: { status?: number } } | null)?.response?.status;
}

/**
 * Mensagem legivel que o backend enviou num erro (ex: "This overlaps another
 * study session."), ou `fallback` se nao houver. O ValidationPipe pode
 * devolver uma lista de mensagens: junta-as.
 */
export function getApiMessage(error: unknown, fallback: string): string {
  const message = (error as { response?: { data?: { message?: unknown } } } | null)?.response?.data?.message;
  if (typeof message === 'string' && message.trim()) return message;
  if (Array.isArray(message) && message.length > 0) return message.join(' ');
  return fallback;
}
