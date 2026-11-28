// Calculos puros do inicio de um quiz.
import { generatedShare, makeGenerated } from './quizPlay';
import { GENERATOR_KINDS, type GeneratorKind } from './quizGenerators';
import type { Quiz, QuizQuestion } from './quizFormat';
import { shuffle, wasAnswered, type QuizSession } from './quizSession';
import { foldText } from './textSearch';

export const toggleItem = <T>(list: T[], value: T): T[] =>
  list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

// Liga ou desliga um gerador, mantendo a ordem do catalogo.
export function toggleGeneratorKind(enabled: GeneratorKind[], kind: GeneratorKind): GeneratorKind[] {
  return GENERATOR_KINDS.filter((k) => (k === kind ? !enabled.includes(k) : enabled.includes(k)));
}

// Respostas ja dadas na tentativa a meio.
export function countAnswered(questions: QuizQuestion[], session: QuizSession | null): number {
  if (!session) return 0;
  const byId = new Map(questions.map((q) => [q.id, q]));
  return session.items.filter((it) => {
    const q = byId.get(it.id);
    return q ? wasAnswered(q, it, session.mode) : false;
  }).length;
}

// Banco de perguntas: topicos escolhidos e texto no enunciado ou nas opcoes.
export function filterBank(questions: Quiz['questions'], topics: string[], search: string): QuizQuestion[] {
  const needle = foldText(search.trim());
  return questions.filter(
    (q) => (topics.length === 0 || topics.includes(q.topic)) && (!needle || foldText(`${q.prompt} ${q.options.join(' ')}`).includes(needle)),
  );
}

// Junta ~25% de perguntas geradas a uma escolha do banco. Sem geradores
// (lista vazia) a escolha fica como esta.
export function mixWithGenerated(
  size: number,
  pick: (n: number) => QuizQuestion[],
  generators: GeneratorKind[],
  t: Parameters<typeof makeGenerated>[2],
): QuizQuestion[] {
  if (generators.length === 0) return pick(size);
  const generated = generatedShare(size);
  return shuffle([...pick(size - generated), ...makeGenerated(generators, generated, t)]);
}
