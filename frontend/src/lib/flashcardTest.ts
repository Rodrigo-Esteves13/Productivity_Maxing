// Teste de pratica a partir das cartas (tipo Quizlet Test): escolha
// multipla com distratores tirados das respostas de outras cartas,
// resposta escrita e verdadeiro/falso. Nao mexe no agendamento SM-2.
import type { Flashcard } from '../types/models';
import { foldText } from './textSearch';

export type QuestionKind = 'choice' | 'typed' | 'trueFalse';

export const TEST_KINDS: QuestionKind[] = ['choice', 'typed', 'trueFalse'];
export const TEST_SIZES = [5, 10, 20] as const;
export const TEST_MIN_CARDS = 2;
// Opcoes totais numa pergunta de escolha multipla (1 certa + distratores).
export const CHOICE_OPTIONS = 4;

export interface TestQuestion {
  card: Flashcard;
  kind: QuestionKind;
  // Escolha multipla: respostas baralhadas, a certa incluida.
  options: string[];
  // Verdadeiro/falso: resposta mostrada e se e a certa.
  shown: string;
  shownIsCorrect: boolean;
}

export type TestAnswer = string | boolean;

type Rand = () => number;

function shuffle<T>(items: T[], rand: Rand): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Respostas de outras cartas, distintas da certa. Mesma cadeira primeiro.
function distractorsFor(card: Flashcard, pool: Flashcard[], rand: Rand): string[] {
  const own = foldText(card.back.trim());
  const seen = new Set([own]);
  const ordered = [
    ...shuffle(pool.filter((c) => c.areaId === card.areaId), rand),
    ...shuffle(pool.filter((c) => c.areaId !== card.areaId), rand),
  ];
  const out: string[] = [];
  for (const other of ordered) {
    const key = foldText(other.back.trim());
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(other.back);
  }
  return out;
}

export function buildTest(
  cards: Flashcard[],
  size: number,
  kinds: QuestionKind[],
  rand: Rand = Math.random,
): TestQuestion[] {
  const allowed = kinds.length > 0 ? kinds : TEST_KINDS;
  const picked = shuffle(cards, rand).slice(0, size);
  return picked.map((card, i) => {
    const wanted = allowed[i % allowed.length];
    const distractors = distractorsFor(card, cards, rand);
    // Sem outras respostas distintas so da para resposta escrita.
    const kind: QuestionKind = wanted !== 'typed' && distractors.length === 0 ? 'typed' : wanted;
    const options =
      kind === 'choice' ? shuffle([card.back, ...distractors.slice(0, CHOICE_OPTIONS - 1)], rand) : [];
    const shownIsCorrect = kind === 'trueFalse' ? rand() < 0.5 : true;
    const shown = kind === 'trueFalse' && !shownIsCorrect ? distractors[0] : card.back;
    return { card, kind, options, shown, shownIsCorrect };
  });
}

// Compara sem acentos, maiusculas, espacos a mais nem pontuacao no fim.
function normalize(text: string): string {
  return foldText(text).replace(/\s+/g, ' ').trim().replace(/[.!?;:,]+$/, '').trim();
}

export function isCorrect(question: TestQuestion, answer: TestAnswer): boolean {
  if (question.kind === 'trueFalse') return answer === question.shownIsCorrect;
  return typeof answer === 'string' && normalize(answer) === normalize(question.card.back);
}

export interface TestScore {
  correct: number;
  total: number;
  percent: number;
  missed: TestQuestion[];
}

export function scoreTest(questions: TestQuestion[], answers: TestAnswer[]): TestScore {
  const missed = questions.filter((q, i) => answers[i] === undefined || !isCorrect(q, answers[i]));
  const correct = questions.length - missed.length;
  const percent = questions.length === 0 ? 0 : Math.round((correct / questions.length) * 100);
  return { correct, total: questions.length, percent, missed };
}
