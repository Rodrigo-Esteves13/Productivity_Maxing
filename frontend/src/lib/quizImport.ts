// Verificacao de seguranca e normalizacao de um quiz em JSON (vindo de um
// ficheiro ou colado). Nunca avalia codigo: so JSON.parse, depois uma
// lista branca de campos, limites de tamanho e texto limpo (sem HTML; so
// o markdown minimo que o QuizRichText desenha como texto). Figuras so como
// dados (ver quizDiagram.ts): a app desenha-as, nunca SVG nem HTML do JSON.
//
// A saida (quiz canonico) e um ponto fixo: verifica-la outra vez da o mesmo
// quiz e todos os checks em 'pass'. O servidor so aceita isso (recheckCanonicalQuiz).
//
// Implementacao em quizImport{Types,Shared,Json,Meta,Question,Check}.ts; o
// backend tem uma copia em quizzes/quiz-check.ts.
export type {
  QuizCheckId,
  QuizCheckStatus,
  QuizCheck,
  QuizSkipReason,
  QuizSkip,
  QuizImportReport,
} from './quizImportTypes';
export { sanitizeQuizText } from './quizImportShared';
export { parseQuizJson } from './quizImportJson';
export { checkQuizText, canonicalQuizText, recheckCanonicalQuiz } from './quizImportCheck';
