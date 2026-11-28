// Resposta certa em texto e envio de perguntas erradas para as flashcards.

import type { QuizKind, QuizQuestion } from './quizFormat';
import { stripQuizMarkdown } from './quizMarkdown';
import { IMPORT_BACK_MAX, IMPORT_FRONT_MAX } from './flashcardImport';
import type { SessionItem } from './quizSessionTypes';
import { range } from './quizGrading';

// Perguntas erradas ja enviadas para as flashcards (por quiz, neste dispositivo),
// para nao oferecer o mesmo cartao duas vezes.
export const QUIZ_CARDS_SENT_MAX_IDS = 500;
export const QUIZ_CARDS_SENT_MAX_QUIZZES = 50;

export const mergeSentIds = (prev: readonly string[], added: readonly string[], max: number = QUIZ_CARDS_SENT_MAX_IDS): string[] =>
  [...new Set([...prev, ...added])].slice(-max);

// Texto da resposta certa (para a revisao e para as flashcards).
export function correctAnswerText(q: QuizQuestion): string {
  const ANSWER_TEXT: Record<QuizKind, () => string> = {
    single: () => q.answer.map((i) => q.options[i]).join('\n'),
    multi: () => q.answer.map((i) => q.options[i]).join('\n'),
    truefalse: () => q.answer.map((i) => q.options[i]).join('\n'),
    typed: () => q.accepted[0] ?? '',
    order: () => q.items.map((item, i) => `${i + 1}. ${item}`).join('\n'),
    match: () => q.left.map((l, i) => `${l}: ${q.right[q.pairs[i]]}`).join('\n'),
  };
  return ANSWER_TEXT[q.kind]();
}

// Item ja com a resposta certa (banco de perguntas: mostrar a chave).
export function answerKeyItem(q: QuizQuestion): SessionItem {
  return {
    id: q.id,
    perm: range(q.kind === 'match' ? q.right.length : q.options.length),
    response: { selected: q.answer, text: q.accepted[0] ?? '', order: range(q.items.length), match: q.pairs },
    flagged: false,
    checked: true,
    timeMs: 0,
  };
}

const ELLIPSIS = '...';
const clip = (text: string, max: number) => (text.length <= max ? text : `${text.slice(0, max - ELLIPSIS.length).replace(/\s+\S*$/, '')}${ELLIPSIS}`);

// Pergunta errada vira cartao: frente = enunciado, verso = resposta certa
// e explicacao (sem marcas de markdown, cortado nos limites dos cartoes).
export function quizQuestionsToCards(questions: QuizQuestion[]): { front: string; back: string }[] {
  return questions.map((q) => ({
    front: clip(stripQuizMarkdown([q.prompt, q.code].filter(Boolean).join('\n')), IMPORT_FRONT_MAX),
    back: clip(stripQuizMarkdown([correctAnswerText(q), q.explanation].filter(Boolean).join('\n\n')), IMPORT_BACK_MAX),
  }));
}
