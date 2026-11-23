import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';
import {
  PRISMA_FOREIGN_KEY_VIOLATION,
  PRISMA_RECORD_NOT_FOUND,
  PRISMA_UNIQUE_VIOLATION,
} from '../prisma-errors';

interface MappedError {
  status: HttpStatus;
  message: string;
  error: string;
}

const NOT_FOUND: MappedError = {
  status: HttpStatus.NOT_FOUND,
  message: 'Resource not found.',
  error: 'Not Found',
};
const CONFLICT: MappedError = {
  status: HttpStatus.CONFLICT,
  message: 'The request conflicts with existing data.',
  error: 'Conflict',
};
const BAD_REQUEST: MappedError = {
  status: HttpStatus.BAD_REQUEST,
  message: 'Invalid request data.',
  error: 'Bad Request',
};
const INTERNAL: MappedError = {
  status: HttpStatus.INTERNAL_SERVER_ERROR,
  message: 'Internal server error',
  error: 'Internal Server Error',
};

const CODE_MAP: Record<string, MappedError> = {
  [PRISMA_RECORD_NOT_FOUND]: NOT_FOUND,
  [PRISMA_UNIQUE_VIOLATION]: CONFLICT,
  [PRISMA_FOREIGN_KEY_VIOLATION]: CONFLICT,
};

/**
 * Filtro global para erros do Prisma que nenhum service tratou (S-14). Sem
 * ele, tudo acabava em 500: um id inexistente num delete (P2025) ou uma Date
 * invalida (PrismaClientValidationError) pareciam falhas do servidor.
 *
 * P2025 -> 404, P2002 e P2003 -> 409, PrismaClientValidationError -> 400.
 * A mensagem e sempre generica (nada de nomes de tabelas ou colunas para o
 * cliente); o detalhe fica so no log. Qualquer outro codigo do Prisma
 * continua a ser um 500 generico, como antes.
 *
 * Excecoes HTTP lancadas pelos services (NotFoundException, etc.) nao passam
 * aqui: este filtro so apanha os tipos de erro do Prisma.
 */
@Catch(Prisma.PrismaClientKnownRequestError, Prisma.PrismaClientValidationError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const mapped = mapPrismaError(exception);

    const detail = exception instanceof Error ? exception.message : '';
    if (mapped.status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        'Unhandled Prisma error',
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(`${mapped.status} from Prisma error: ${detail}`);
    }

    response.status(mapped.status).json({
      statusCode: mapped.status,
      message: mapped.message,
      error: mapped.error,
    });
  }
}

export function mapPrismaError(exception: unknown): MappedError {
  if (exception instanceof Prisma.PrismaClientValidationError) {
    return BAD_REQUEST;
  }
  if (exception instanceof Prisma.PrismaClientKnownRequestError) {
    return CODE_MAP[exception.code] ?? INTERNAL;
  }
  return INTERNAL;
}
