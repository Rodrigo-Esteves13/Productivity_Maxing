// (tipo, seed) -> pergunta.

import type { QuizQuestion } from './quizFormat';
import { type GeneratorKind, type Translate, type GeneratedQuestion, generatedId } from './quizGeneratorIds';
import { mulberry32 } from './quizGeneratorRandom';
import type { Generator } from './quizGeneratorDraft';
import {
  genWildcard,
  genNetworkCmd,
  genNetworkMatch,
  genSubnetInfo,
  genUsableHosts,
  genSummarize,
  genBinaryDecimal,
} from './quizGeneratorSubnetting';
import { genOspfCost, genRouterId, genDrBdr, genLongestMatch } from './quizGeneratorOspf';
import { genSpfPath } from './quizGeneratorSpf';

// ---------------------------------------------------------------------------
const GENERATORS: Record<GeneratorKind, Generator> = {
  wildcard: genWildcard,
  networkCmd: genNetworkCmd,
  networkMatch: genNetworkMatch,
  ospfCost: genOspfCost,
  spfPath: genSpfPath,
  routerId: genRouterId,
  drBdr: genDrBdr,
  longestMatch: genLongestMatch,
  subnetInfo: genSubnetInfo,
  usableHosts: genUsableHosts,
  summarize: genSummarize,
  binaryDecimal: genBinaryDecimal,
};

// Mesma (tipo, seed, lingua) -> mesma pergunta.
export function generateQuestion(kind: GeneratorKind, seed: number, t: Translate): GeneratedQuestion {
  const draft = GENERATORS[kind](mulberry32(seed), t);
  const id = generatedId(kind, seed);
  const question: QuizQuestion = {
    id,
    topic: t(`quizGen.${kind}.name`),
    kind: draft.kind,
    prompt: draft.prompt,
    code: draft.code ?? null,
    figure: draft.figure ? id : null,
    options: draft.options ?? [],
    answer: draft.answer ?? [],
    accepted: draft.accepted ?? [],
    items: [],
    left: [],
    right: [],
    pairs: [],
    explanation: draft.explanation,
    sources: [],
  };
  return { question, figure: draft.figure ?? null };
}
