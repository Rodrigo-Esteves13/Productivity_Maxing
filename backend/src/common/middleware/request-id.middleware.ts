import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { runWithRequestId } from '../request-context';

export const REQUEST_ID_HEADER = 'x-request-id';

// So aceitamos ids "inofensivos" vindos do cliente: o valor acaba em logs
// e num header de resposta, por isso nada de espacos, quebras de linha ou
// tamanhos arbitrarios (log injection / header splitting).
const SAFE_REQUEST_ID = /^[A-Za-z0-9._-]{8,64}$/;

export function resolveRequestId(incoming: unknown): string {
  return typeof incoming === 'string' && SAFE_REQUEST_ID.test(incoming)
    ? incoming
    : randomUUID();
}

/**
 * Atribui um id a cada pedido (o do cliente, se for valido; senao um novo),
 * devolve-o no header `x-request-id` e guarda-o em AsyncLocalStorage para o
 * JsonLogger o juntar a cada linha de log desse pedido.
 */
export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const requestId = resolveRequestId(req.headers[REQUEST_ID_HEADER]);
  res.setHeader(REQUEST_ID_HEADER, requestId);
  runWithRequestId(requestId, next);
}
