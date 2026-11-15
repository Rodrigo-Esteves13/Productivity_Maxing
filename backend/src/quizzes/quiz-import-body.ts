import {
  json,
  type NextFunction,
  type Request,
  type RequestHandler,
  type Response,
} from 'express';
import type { ImportQuizDto } from './dto/quiz.dto';
import { QUIZ_IMPORT_BODY_LIMIT, QUIZ_IMPORT_PATH } from './quizzes.constants';

const IMPORT_METHOD = 'POST';
// Unica chave aceite no corpo do import (ver ImportQuizDto).
const IMPORT_BODY_KEY: keyof ImportQuizDto = 'quizJson';
// Chave do valor de topo na chamada final do reviver do JSON.parse.
const ROOT_KEY = '';

// Usa `parser` (o JSON com o limite maior) so no POST exato de
// QUIZ_IMPORT_PATH: sem prefixo ("/quizzes/import/x") nem outra capitalizacao.
// Os outros pedidos seguem para o parser global, com o limite por defeito.
// Devolve uma funcao anonima de proposito: o Nest so regista o seu parser JSON
// se nao houver ja uma camada chamada "jsonParser", e o json() do express tem
// esse nome (sem o embrulho, todas as outras rotas ficavam sem corpo).
export function quizImportBodyOnly(parser: RequestHandler): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method === IMPORT_METHOD && req.path === QUIZ_IMPORT_PATH) {
      parser(req, res, next);
      return;
    }
    next();
  };
}

// Reviver do JSON do import. O corpo valido e so { quizJson: texto }, por isso
// nenhum objeto nem lista aninhados passam (ficam null) e um corpo com outra
// forma passa a {} (o DTO recusa com 400). Assim o ValidationPipe nunca ve um
// objeto largo ou fundo: o class-transformer e quadratico em objetos largos
// (110k chaves: ~4.6 s) e rebenta a pilha em listas muito aninhadas.
export function importBodyReviver(key: string, value: unknown): unknown {
  const isObject = typeof value === 'object' && value !== null;
  if (key !== ROOT_KEY) return isObject ? null : value;
  const keys = isObject && !Array.isArray(value) ? Object.keys(value) : [];
  return keys.length === 1 && keys[0] === IMPORT_BODY_KEY ? value : {};
}

// Parser do corpo do import, para o main.ts (antes do parser global).
export function createQuizImportBodyParser(): RequestHandler {
  return quizImportBodyOnly(
    json({ limit: QUIZ_IMPORT_BODY_LIMIT, reviver: importBodyReviver }),
  );
}
