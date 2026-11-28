// Rascunho de uma pergunta gerada e ajudas comuns aos geradores.

import type { QuizKind } from './quizFormat';
import type { QuizDiagram } from './quizDiagram';
import type { Translate, Rand } from './quizGeneratorIds';
import { shuffleWith } from './quizGeneratorRandom';
import { numberToIp, prefixMask } from './quizGeneratorNet';

// ---------------------------------------------------------------------------
// Rascunho de cada gerador; generateQuestion completa o resto.
interface Draft {
  kind: QuizKind;
  prompt: string;
  code?: string;
  options?: string[];
  answer?: number[];
  accepted?: string[];
  explanation: string;
  figure?: QuizDiagram;
}

export type Generator = (r: Rand, t: Translate) => Draft;

// Escolha: certas e erradas baralhadas com a seed (o indice certo varia).
export function choice(r: Rand, right: readonly string[], wrong: readonly string[], prompt: string, explanation: string): Draft {
  const all = shuffleWith(r, [...right.map((text) => ({ text, ok: true })), ...wrong.map((text) => ({ text, ok: false }))]);
  return {
    kind: right.length > 1 ? 'multi' : 'single',
    prompt,
    options: all.map((o) => o.text),
    answer: all.flatMap((o, i) => (o.ok ? [i] : [])),
    explanation,
  };
}

export const typed = (prompt: string, accepted: string[], explanation: string, code?: string): Draft => ({
  kind: 'typed',
  prompt,
  accepted: [...new Set(accepted)],
  explanation,
  code,
});

export const prefixAnswers = (prefix: number) => [`/${prefix}`, String(prefix), numberToIp(prefixMask(prefix))];
export const cmd = (text: string) => `\`${text}\``;
const OSPF_AREA = 0;
export const networkCommand = (network: number, wildcard: number) => `network ${numberToIp(network)} ${numberToIp(wildcard)} area ${OSPF_AREA}`;
