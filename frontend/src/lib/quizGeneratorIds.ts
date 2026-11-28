// Tipos de gerador, ids "gen-<tipo>-<seed>" e seeds.

import type { QuizQuestion } from './quizFormat';
import type { QuizDiagram } from './quizDiagram';

export const GENERATOR_KINDS = [
  'wildcard',
  'networkCmd',
  'networkMatch',
  'ospfCost',
  'spfPath',
  'routerId',
  'drBdr',
  'longestMatch',
  'subnetInfo',
  'usableHosts',
  'summarize',
  'binaryDecimal',
] as const;
export type GeneratorKind = (typeof GENERATOR_KINDS)[number];
export type Translate = (key: string, params?: Record<string, string | number>) => string;
export type Rand = () => number;

export interface GeneratedQuestion {
  question: QuizQuestion;
  figure: QuizDiagram | null;
}

// Seeds validas: inteiros 1..2^31-1.
export const GENERATOR_MIN_SEED = 1;
export const GENERATOR_MAX_SEED = 2 ** 31 - 1;
const GENERATED_ID_PREFIX = 'gen';
const GENERATED_ID = /^gen-([A-Za-z]+)-([1-9]\d*)$/;

export const isGeneratorKind = (v: unknown): v is GeneratorKind =>
  typeof v === 'string' && (GENERATOR_KINDS as readonly string[]).includes(v);
export const generatedId = (kind: GeneratorKind, seed: number) => `${GENERATED_ID_PREFIX}-${kind}-${seed}`;
export const generatorStatKey = (kind: GeneratorKind) => `${GENERATED_ID_PREFIX}-${kind}`;

// Estrito: so aceita exatamente o que generatedId produz.
export function parseGeneratedId(id: string): { kind: GeneratorKind; seed: number } | null {
  const m = GENERATED_ID.exec(id);
  if (!m || !isGeneratorKind(m[1])) return null;
  const seed = Number(m[2]);
  if (!Number.isSafeInteger(seed) || seed < GENERATOR_MIN_SEED || seed > GENERATOR_MAX_SEED) return null;
  return generatedId(m[1], seed) === id ? { kind: m[1], seed } : null;
}

// gen-<tipo>-<seed> -> gen-<tipo> (estatisticas por gerador); outro id fica igual.
export const statKeyOf = (questionId: string): string => {
  const parsed = parseGeneratedId(questionId);
  return parsed ? generatorStatKey(parsed.kind) : questionId;
};

export function newSeed(rand: Rand = Math.random): number {
  const seed = GENERATOR_MIN_SEED + Math.floor(rand() * GENERATOR_MAX_SEED);
  return Math.min(GENERATOR_MAX_SEED, Math.max(GENERATOR_MIN_SEED, seed));
}
