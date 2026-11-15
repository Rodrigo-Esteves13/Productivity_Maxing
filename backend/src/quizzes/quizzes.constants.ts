import { QUIZ_MAX_FILE_BYTES } from './quiz-format';

export const MAX_QUIZZES_PER_USER = 50;
export const QUIZ_WRITES_PER_MINUTE = 30;
export const QUIZ_IMPORTS_PER_MINUTE = 10;
// Tentativas guardadas por quiz (as mais antigas saem).
export const QUIZ_ATTEMPTS_KEPT = 100;
export const QUIZ_ATTEMPT_MAX_DURATION_MS = 24 * 60 * 60 * 1000;
// POST /quizzes/import: o corpo e { quizJson: texto canonico }, com o texto ate
// QUIZ_MAX_FILE_BYTES. Dentro de uma string JSON cada byte do texto ocupa no
// maximo 2 (\" e \\ sao os piores casos; o texto canonico nao tem caracteres de
// controlo crus), mais as chaves e aspas do objeto. Assim um quiz que passa a
// verificacao de tamanho do cliente cabe sempre no limite do corpo.
export const QUIZ_IMPORT_PATH = '/quizzes/import';
export const QUIZ_JSON_ESCAPE_FACTOR = 2;
export const QUIZ_IMPORT_BODY_OVERHEAD_BYTES = 1024;
export const QUIZ_IMPORT_BODY_LIMIT =
  QUIZ_MAX_FILE_BYTES * QUIZ_JSON_ESCAPE_FACTOR +
  QUIZ_IMPORT_BODY_OVERHEAD_BYTES;
