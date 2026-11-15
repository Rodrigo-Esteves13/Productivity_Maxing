// Quiz "jogavel": o quiz guardado mais as perguntas geradas pela app
// (quizGenerators) que uma tentativa usa. As geradas nunca vem do ficheiro:
// sao refeitas a partir do id (tipo + seed), por isso a sessao guardada so
// precisa dos ids.
import type { Quiz, QuizQuestion } from './quizFormat';
import type { QuizDiagram } from './quizDiagram';
import { shuffle } from './quizSession';
import { generateQuestion, isGeneratorKind, newSeed, parseGeneratedId, type GeneratorKind, type Translate } from './quizGenerators';

// Parte de perguntas geradas quando se mistura num exame ou pratica (como no exemplo).
export const GENERATED_MIX_SHARE = 0.25;
export const CALC_SIZES = [10, 20, 30] as const;

// Tipos ligados neste quiz, sem repetidos nem valores desconhecidos.
export const enabledKinds = (raw: readonly unknown[] | undefined): GeneratorKind[] => [...new Set((raw ?? []).filter(isGeneratorKind))];

// Junta ao quiz as perguntas geradas que aparecem em `ids` (de tipos ligados).
export function withGenerated(quiz: Quiz, ids: readonly string[], kinds: readonly GeneratorKind[], t: Translate): Quiz {
  const allowed = new Set(kinds);
  const questions: QuizQuestion[] = [];
  const figures: Record<string, QuizDiagram> = {};
  const seen = new Set<string>();
  ids.forEach((id) => {
    const parsed = parseGeneratedId(id);
    if (!parsed || !allowed.has(parsed.kind) || seen.has(id)) return;
    seen.add(id);
    const { question, figure } = generateQuestion(parsed.kind, parsed.seed, t);
    questions.push(question);
    if (figure && question.figure) figures[question.figure] = figure;
  });
  if (questions.length === 0) return quiz;
  return { ...quiz, questions: [...quiz.questions, ...questions], figures: { ...quiz.figures, ...figures } };
}

// N perguntas geradas, a rodar pelos tipos pedidos (cada uma com seed nova).
export function makeGenerated(kinds: readonly GeneratorKind[], count: number, t: Translate, rand: () => number = Math.random): QuizQuestion[] {
  if (kinds.length === 0) return [];
  const order = shuffle(kinds, rand);
  return Array.from({ length: count }, (_, i) => generateQuestion(order[i % order.length], newSeed(rand), t).question);
}

// Quantas geradas entram numa tentativa de `size` perguntas.
export const generatedShare = (size: number): number => Math.round(size * GENERATED_MIX_SHARE);
