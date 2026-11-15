// Formato dos quizzes gerados fora da app (prompt copiado para qualquer IA)
// e carregados como JSON. Tudo corre no browser: o ficheiro e verificado,
// limpo e guardado so neste dispositivo ate o descartares.
import type { QuizDiagram } from './quizDiagram';

export const QUIZ_FORMAT_ID = 'pmaxing-quiz';
export const QUIZ_FORMAT_VERSION = 1;

export const QUIZ_KINDS = ['single', 'multi', 'truefalse', 'typed', 'order', 'match'] as const;
export type QuizKind = (typeof QUIZ_KINDS)[number];

// Limites da verificacao (ficheiro, estrutura e textos).
export const QUIZ_MAX_FILE_BYTES = 1024 * 1024;
export const QUIZ_MAX_QUESTIONS = 500;
export const QUIZ_MAX_TOPICS = 50;
export const QUIZ_MAX_DEPTH = 8;
export const QUIZ_TITLE_MAX = 120;
export const QUIZ_TOPIC_MAX = 80;
export const QUIZ_LANGUAGE_MAX = 16;
export const QUIZ_PROMPT_MIN = 5;
export const QUIZ_PROMPT_MAX = 2000;
export const QUIZ_CODE_MAX = 4000;
export const QUIZ_OPTION_MAX = 500;
export const QUIZ_EXPLANATION_MAX = 3000;
export const QUIZ_MIN_OPTIONS = 3;
export const QUIZ_MAX_OPTIONS = 8;
export const QUIZ_MIN_ITEMS = 3;
export const QUIZ_MAX_ITEMS = 10;
export const QUIZ_MAX_ACCEPTED = 10;
export const QUIZ_MAX_SOURCES = 5;
export const QUIZ_SOURCE_TITLE_MAX = 200;
export const QUIZ_URL_MAX = 2000;
export const TRUE_FALSE_OPTIONS = 2;
// Diagramas por quiz e tamanho maximo do id de cada um.
export const QUIZ_MAX_FIGURES = 40;
export const QUIZ_FIGURE_ID_MAX = 40;

// Exame cronometrado como no quiz de exemplo: 72 s por pergunta.
export const QUIZ_DEFAULT_SECONDS_PER_QUESTION = 72;
export const QUIZ_MIN_SECONDS_PER_QUESTION = 15;
export const QUIZ_MAX_SECONDS_PER_QUESTION = 600;

export interface QuizSource {
  title: string;
  url: string | null;
}

export interface QuizQuestion {
  id: string;
  topic: string;
  kind: QuizKind;
  prompt: string;
  code: string | null;
  // Id de um diagrama em Quiz.figures (mostrado com a pergunta).
  figure: string | null;
  // single, multi, truefalse: opcoes e indices certos.
  options: string[];
  answer: number[];
  // typed: respostas aceites.
  accepted: string[];
  // order: itens pela ordem certa.
  items: string[];
  // match: cada item da esquerda liga a um indice da direita.
  left: string[];
  right: string[];
  pairs: number[];
  explanation: string;
  sources: QuizSource[];
}

export interface Quiz {
  title: string;
  language: string;
  secondsPerQuestion: number;
  topics: string[];
  questions: QuizQuestion[];
  // Diagramas canonicos (so dados, ver quizDiagram.ts), partilhados entre perguntas.
  figures: Record<string, QuizDiagram>;
}

// Resposta do aluno, por tipo.
export interface QuizResponse {
  selected: number[];
  text: string;
  // order: indices (dos itens originais) pela ordem escolhida.
  order: number[];
  // match: para cada item da esquerda, indice escolhido da direita (-1 vazio).
  match: number[];
}

export const EMPTY_RESPONSE: QuizResponse = { selected: [], text: '', order: [], match: [] };
